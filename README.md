ARQUIVOS ENTREGUES
- app.supabase.js                -> app.js ajustado para Supabase + login
- auth.js                        -> lógica da tela de login
- login.html                     -> tela de acesso
- supabase-config.example.js     -> arquivo modelo com URL e anon key
- geoambiental_supabase_schema.sql -> schema/tabelas/policies do banco

ALTERACOES NO INDEX.HTML
1) Antes do fechamento do </body>, inclua:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="js/supabase-config.js"></script>
   <script src="js/app.js"></script>

2) Troque o app.js antigo por este arquivo novo (renomeie app.supabase.js para app.js).

3) Opcional: adicionar um botão de logout na topbar:
   <button class="btn btn-secondary btn-sm" data-action="logout">Sair</button>

ESTRUTURA SUGERIDA
/public_html/sistema/
  index.html
  login.html
  /css/style.css
  /js/app.js
  /js/auth.js
  /js/supabase-config.js

PASSOS
1. Criar projeto no Supabase.
2. Rodar o arquivo geoambiental_supabase_schema.sql no SQL Editor.
3. Criar o primeiro usuário em Authentication > Users.
4. Editar o perfil desse usuário na tabela profiles e definir role='admin'.
5. Copiar supabase-config.example.js para js/supabase-config.js e preencher URL/anon key.
6. Subir os arquivos para o subdomínio do sistema.
7. Testar login em login.html.

OBSERVACAO
O app ajustado presume que as tabelas usam UUID em id e, opcionalmente, legacy_id para migração.
