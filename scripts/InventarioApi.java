import com.github.javaparser.*;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/** Extrai os mappings e percorre campos injetados e chamadas locais sem inicializar o Spring. */
public class InventarioApi {
    static final Map<String, ClassOrInterfaceDeclaration> types = new TreeMap<>();
    static final Map<String, Path> files = new HashMap<>();
    static final Pattern sql = Pattern.compile("(?i)\\b(dbo|acesso)\\.\\[?([\\p{L}\\w]+)");
    static final Map<String, Set<String>> implementations = new HashMap<>();

    static String annotation(com.github.javaparser.ast.nodeTypes.NodeWithAnnotations<?> node, String name) {
        return node.getAnnotationByName(name).flatMap(a -> a.findFirst(StringLiteralExpr.class))
                .map(StringLiteralExpr::asString).orElse("");
    }
    static String simple(String type) {
        return type.replaceFirst("<.*","").replaceFirst(".*\\.","");
    }
    static Set<String> ordered() { return new TreeSet<>(); }
    static class Trace {
        final Set<String> seen=ordered(), services=ordered(), repos=ordered(), objects=ordered(), scopes=ordered();
        void sources(String text) {
            var m=sql.matcher(text);
            while(m.find()) objects.add(m.group(1).toLowerCase()+"."+m.group(2).toLowerCase());
        }
        void follow(String owner,String name,int arity) {
            if(!seen.add(owner+"."+name+"/"+arity))return;
            var type=types.get(owner);
            if(type==null)return;
            if(owner.endsWith("Service") || owner.endsWith("Gateway") || owner.endsWith("Client")) services.add(owner);
            if(owner.contains("Repository") || owner.endsWith("Store") || owner.endsWith("DataSource")) {
                repos.add(owner);
                for(var ext:type.getExtendedTypes()) {
                    if(ext.getNameAsString().contains("Repository")) {
                        ext.getTypeArguments().ifPresent(args -> {
                            var entity=types.get(args.get(0).asString());
                            if(entity!=null) entity.getAnnotationByName("Table").ifPresent(a -> {
                                var vals=new HashMap<String,String>();
                                a.findAll(MemberValuePair.class).forEach(pair -> vals.put(pair.getNameAsString(),pair.getValue().toString().replace("\"","")));
                                if(vals.containsKey("name")) objects.add(vals.getOrDefault("schema","dbo")+"."+vals.get("name"));
                            });
                        });
                    }
                }
            }
            for(var impl:implementations.getOrDefault(owner,Set.of()))follow(impl,name,arity);
            var fields=new HashMap<String,VariableDeclarator>();
            for(var f:type.getFields()) for(var v:f.getVariables()) fields.put(v.getNameAsString(),v);
            for(var method:type.getMethodsByName(name)) {
                if(method.getParameters().size()!=arity)continue;
                sources(method.toString());
                for(var n:method.findAll(NameExpr.class)) {
                    var field=fields.get(n.getNameAsString());
                    if(field!=null) field.getInitializer().ifPresent(i->sources(i.toString()));
                }
                for(var call:method.findAll(MethodCallExpr.class)) {
                    var receiver=call.getScope().map(Object::toString).orElse("this").replaceFirst("^this\\.","");
                    var field=fields.get(receiver);
                    var target=receiver.equals("this")?owner:field!=null?simple(field.getTypeAsString()):receiver;
                    if(receiver.matches("\\w+\\(\\)")) {
                        var getters=type.getMethodsByName(receiver.substring(0,receiver.length()-2));
                        if(getters.size()==1)target=simple(getters.get(0).getTypeAsString());
                    }
                    if(target.contains("EscopoFilial"))scopes.add(target+"."+call.getNameAsString());
                    if(types.containsKey(target))follow(target,call.getNameAsString(),call.getArguments().size());
                }
                for(var ref:method.findAll(MethodReferenceExpr.class)) {
                    var receiver=ref.getScope().toString();
                    var field=fields.get(receiver);
                    var target=receiver.equals("this")?owner:field!=null?simple(field.getTypeAsString()):receiver;
                    if(types.containsKey(target))for(var candidate:types.get(target).getMethodsByName(ref.getIdentifier()))
                        follow(target,ref.getIdentifier(),candidate.getParameters().size());
                }
            }
        }
    }
    static String clean(String s){return s.replace('\t',' ').replace('\n',' ').replace('\r',' ');}
    public static void main(String[] args) throws Exception {
        var root=Path.of("backend/src/main/java");
        var parser=new JavaParser(new ParserConfiguration().setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17));
        try(var walk=Files.walk(root)) {
            for(var path:walk.filter(p->p.toString().endsWith(".java")).sorted().toList()) {
                var result=parser.parse(path);
                if(!result.isSuccessful())throw new IllegalArgumentException(path.toString());
                for(var t:result.getResult().orElseThrow().getTypes()) if(t.isClassOrInterfaceDeclaration()){
                    var c=t.asClassOrInterfaceDeclaration(); types.put(c.getNameAsString(),c); files.put(c.getNameAsString(),path);
                    for(var ext:c.getImplementedTypes())implementations.computeIfAbsent(ext.getNameAsString(),k->ordered()).add(c.getNameAsString());
                }
            }
        }
        System.out.println("http\turl\tcontroller\tline\tmethod\tpermission\tparams\tservices\trepositories\tobjects\tscope");
        for(var c:types.values())for(var m:c.getMethods())for(var a:m.getAnnotations()){
            var ann=a.getNameAsString();
            if(!List.of("GetMapping","PostMapping","DeleteMapping","PutMapping","PatchMapping","RequestMapping").contains(ann))continue;
            if(ann.equals("RequestMapping"))throw new IllegalStateException("Verificar verbos em "+m.getNameAsString());
            var http=ann.substring(0,ann.length()-7).toUpperCase();
            var base=annotation(c,"RequestMapping");
            var paths=a.findAll(StringLiteralExpr.class).stream().map(StringLiteralExpr::asString)
                    .filter(p->p.startsWith("/")).toList();
            if(paths.isEmpty())paths=List.of("");
            var perm=annotation(m,"PreAuthorize");
            if(perm.isBlank())perm=annotation(c,"PreAuthorize");
            var trace=new Trace();
            trace.follow(c.getNameAsString(),m.getNameAsString(),m.getParameters().size());
            var params=m.getParameters().stream().filter(p->p.getAnnotations().stream().anyMatch(x->
                    Set.of("RequestParam","PathVariable","RequestBody","RequestPart","CookieValue","RequestHeader").contains(x.getNameAsString())))
                    .map(p->p.getNameAsString()+":"+p.getTypeAsString()).collect(Collectors.joining(", "));
            for(var suffix:paths) System.out.println(String.join("\t",http,base+suffix,files.get(c.getNameAsString()).toString().replace('\\','/'),
                    ""+a.getBegin().orElseThrow().line,m.getNameAsString(),clean(perm),params,String.join(", ",trace.services),
                    String.join(", ",trace.repos),String.join(", ",trace.objects),String.join(", ",trace.scopes)));
        }
    }
}
