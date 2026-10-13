# Biblioteca Virtual

Template vazio para criar uma biblioteca pessoal de leituras com estantes em CSS 3D, busca de livros, anotações, progresso e ritmo de leitura.

## Forma mais fácil de começar

1. Crie um repositório usando este template.
2. Abra a nova pasta no Codex.
3. Envie o prompt abaixo.
4. Siga as instruções que a IA apresentar para criar seu próprio Supabase e publicar na Vercel.

```text
Quero configurar este template como a minha biblioteca virtual pessoal.

Analise o projeto antes de alterar qualquer arquivo. Depois:
1. instale as dependências;
2. me oriente para criar um projeto novo no Supabase;
3. me mostre como executar o arquivo supabase/schema.sql;
4. crie meu arquivo .env.local usando .env.example, sem exibir ou enviar meus segredos;
5. gere valores fortes e diferentes para SETUP_SECRET e CRON_SECRET;
6. teste o projeto localmente;
7. me ajude a criar meu primeiro acesso;
8. revise se nenhum dado pessoal ou segredo será enviado ao GitHub;
9. somente depois me oriente para publicar na Vercel.

Pare e me peça os dados necessários em cada etapa. Nunca coloque chaves, e-mail ou senha em arquivos versionados.
```

## O que vem no template

- Biblioteca inicialmente vazia.
- Cadastro, edição e exclusão de livros.
- Busca por título, autor ou ISBN usando fontes públicas.
- Estantes com lombadas em 3D.
- Filtros, agrupamentos e ordenação.
- Progresso, avaliações e anotações.
- Calendário e sequência de leitura.
- Login privado para um único proprietário.
- Banco, autenticação e armazenamento de capas no Supabase.

## Segurança

- Nenhum livro, anotação, capa, e-mail, senha ou chave acompanha o template.
- O arquivo `.env.example` contém somente nomes de variáveis vazias.
- Arquivos `.env*`, exportações e dados importados são ignorados pelo Git.
- O primeiro cadastro exige um `SETUP_SECRET` definido pelo próprio usuário.
- A chave secreta do Supabase é usada somente no servidor.
- As tabelas usam Row Level Security para separar os dados por usuário.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local
npm run dev
```

O esquema inicial do banco está em `supabase/schema.sql`.

## Licença

MIT.
