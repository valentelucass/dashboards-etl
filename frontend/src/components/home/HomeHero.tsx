import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';

export default function HomeHero({ nome }: { nome: string }) {
  const displayName = nome.split('|')[0]?.trim() || nome;

  return (
    <Card padding={5} className="home-greeting">
      <Heading level={1} className="home-hero-title home-wrap-text">Bem-vindo, {displayName}</Heading>
    </Card>
  );
}
