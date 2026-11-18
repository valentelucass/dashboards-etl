// Executar na raiz com Node e as dependências do frontend instaladas.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const config = path.join(root, 'frontend/tsconfig.app.json');
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(config, ts.sys.readFile).config, ts.sys,
  path.dirname(config));
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();
const sources = program.getSourceFiles().filter(f => f.fileName.replaceAll('\\','/').includes('/frontend/src/')
  && !/\.(?:test|spec)\.[jt]sx?$/.test(f.fileName) && !f.isDeclarationFile);
const files = new Set(sources);
const owners = new Map();
const authActions = new Map();
const dependencies = new Map();
const calls = [];
const entries = {};
const routes = [];
function top(n) {
  while (n.parent && !ts.isSourceFile(n.parent)) n=n.parent;
  return n;
}
function declarations(n) {
  let s=checker.getSymbolAtLocation(n);
  if (s && s.flags & ts.SymbolFlags.Alias) s=checker.getAliasedSymbol(s);
  return (s?.declarations ?? []).filter(d => files.has(d.getSourceFile()));
}
function url(n, depth=0) {
  if (!n || depth>6) return '{}';
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map(s=>url(s.expression,depth+1)+s.literal.text).join('');
  if (ts.isIdentifier(n)) {
    if (n.text==='API_BASE_URL') return '';
    const d=declarations(n)[0];
    if (d && (ts.isVariableDeclaration(d) || ts.isParameter(d))) return url(d.initializer,depth+1);
  }
  return '{}';
}
function rel(f){return path.relative(root,f.fileName).replaceAll('\\','/');}
for (const f of sources) {
  for (const stmt of f.statements) {
    if (ts.isImportDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) continue;
    const deps=new Set(); dependencies.set(stmt,deps);
    function visit(n) {
      if (ts.isTypeNode(n)) return;
      if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer &&
          ts.isCallExpression(n.initializer) && n.initializer.expression.getText()==='useAutenticacao') {
        const actions=authActions.get(stmt)??new Set();
        for(const property of n.name.elements)actions.add((property.propertyName??property.name).getText());
        authActions.set(stmt,actions);
      }
      if (ts.isIdentifier(n)) {
        for (const d of declarations(n)) {
          const t=top(d);
          if (t!==stmt && !ts.isImportDeclaration(t)) deps.add(t);
        }
        if(ts.isShorthandPropertyAssignment(n.parent)) {
          const s=checker.getShorthandAssignmentValueSymbol(n.parent);
          for(const d of s?.declarations??[]) if(files.has(d.getSourceFile())) deps.add(top(d));
        }
      }
      if (ts.isCallExpression(n)) {
        const expr=n.expression.getText(f);
        const m=/^(?:clienteAxios|axios)\.(get|post|put|delete|patch|head)$/i.exec(expr);
        const method=m?.[1] ?? (['baixarCsv','baixarCsvComParametros','buscarTabelaPaginada'].includes(expr)?'get':null);
        if(method) {
          const route=url(n.arguments[0]);
          if(route.startsWith('/api/')) {
            let owner=stmt, func=stmt.name?.getText()??expr;
            // Métodos de uma fábrica podem ser exportados separadamente e usados por páginas diferentes.
            const methodNode=ts.findAncestor(n,ts.isMethodDeclaration);
            if(methodNode) {
              const alias=f.statements.find(s=>ts.isVariableStatement(s) && s.declarationList.declarations.some(d=>
                d.initializer && ts.isPropertyAccessExpression(d.initializer) &&
                declarations(d.initializer.name).includes(methodNode)));
              if(alias) { owner=alias; func=alias.declarationList.declarations[0].name.getText(); }
            }
            calls.push({method:method.toUpperCase(),url:route,owner,file:rel(f),
              line:f.getLineAndCharacterOfPosition(n.getStart()).line+1,func});
          }
        }
      }
      ts.forEachChild(n,visit);
    }
    visit(stmt);
    const page=/\/pages\/(\w+Page)\.tsx$/.exec(rel(f));
    if(page && stmt.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)) entries[page[1]]=stmt;
    if(stmt.name && ['LayoutPainel','AutenticacaoProvider','RotaProtegida'].includes(stmt.name.text)) entries[stmt.name.text]=stmt;
    if(/\/App\.tsx$/.test(rel(f))) {
      function route(n) {
        if(ts.isJsxSelfClosingElement(n) && n.tagName.getText()==='Route') {
          const val=n.attributes.properties.find(a=>a.name?.getText()==='path');
          if(val) {
            const guards=[];
            for(let p=n.parent;p;p=p.parent) if(ts.isJsxElement(p)) {
              const s=p.openingElement.getText();
              if(s.includes('RotaProtegida')) guards.push(s.match(/permissao="([^"]+)"/)?.[1] ?? (s.includes('adminOnly')?'admin':s.includes('allowPasswordChange')?'sessão inclusive troca de senha':'sessão'));
            }
            routes.push({path:val.initializer.text,element:n.attributes.properties.find(a=>a.name?.getText()==='element')?.initializer.getText(),guards});
          }
        }
        ts.forEachChild(n,route);
      }
      route(stmt);
    }
  }
}
for (const [name,entry] of Object.entries(entries)) {
  const seen=new Set(),stack=[entry];
  while(stack.length) {
    const node=stack.pop();
    if(seen.has(node))continue;
    seen.add(node);
    if(!owners.has(node))owners.set(node,[]);
    owners.get(node).push(name);
    for(const d of dependencies.get(node)??[])stack.push(d);
  }
}
// O provedor expõe callbacks por contexto React, sem import direto na página.
const authFunctions={login:'loginUsuario',logout:'logoutUsuario',alterarSenha:'alterarSenha',
  concluirTrocaSenhaObrigatoria:'concluirTrocaSenhaObrigatoria'};
for(const call of calls) {
  if(!call.file.endsWith('/authServico.ts'))continue;
  const pages=new Set(owners.get(call.owner)??[]);
  for(const [stmt,actions] of authActions) {
    if([...actions].some(a=>authFunctions[a]===call.func)) {
      for(const p of owners.get(stmt)??[])pages.add(p);
    }
  }
  owners.set(call.owner,[...pages]);
}
process.stdout.write(JSON.stringify({routes,entries:Object.keys(entries),calls:calls.map(({owner,...c})=>({...c,
  pages:(owners.get(owner)??[]).sort()}))},null,2));
