# Mapa de Solos da Paraiba

Aplicacao web simples para consultar dados reais de solo por coordenada ou pelo contorno desenhado de uma propriedade rural na Paraiba. O projeto usa Leaflet no frontend, Node.js/Express no backend e Supabase/PostGIS como banco.

## Fluxo da aplicacao

1. O usuario informa uma coordenada, clica no mapa ou desenha o contorno da propriedade.
2. O frontend calcula o ponto de consulta. Para poligonos, usa o centroide aproximado do contorno e calcula a area em hectares.
3. O backend consulta dados reais do SoilGrids para a coordenada selecionada.
4. A API retorna pH, textura, fertilidade estimada, argila, areia, silte, nitrogenio, CEC e carbono organico.
5. O painel exibe as informacoes do solo no contexto do Verde Arido, sem CAR, login ou dados privados.

## Fontes e integracao

- **geobr**: geometria municipal oficial. O seed baixa `municipalities_2025_simplified.parquet` do release `v2.0.0` do projeto geobr.
- **SoilGrids**: dados reais de solo por latitude/longitude.
- **Supabase/PostGIS**: armazena os municipios da PB e cacheia consultas reais por coordenada.
- **Chave municipal**: `code_muni`, codigo IBGE de 7 digitos.
- **Escopo**: somente Paraiba (`PB` / `code_state = 25`) para manter o volume adequado ao Supabase.

O seed converte o GeoParquet do geobr para GeoJSON, filtra PB e grava a geometria municipal no Supabase. As consultas de propriedades usam a coordenada selecionada pelo agricultor; quando o Supabase esta configurado, a API tambem identifica o municipio por intersecao espacial e salva a resposta real em `soil_point_cache`.

## Requisitos

- Node.js 20+
- Projeto Supabase com PostGIS
- Banco com o SQL de `database/schema.sql` aplicado

## Configuracao local

```bash
npm install
copy .env.example .env
```

Edite `.env` com o `DATABASE_URL` do Supabase quando quiser usar o banco.

Aplicar schema no Supabase:

```sql
-- Rode o conteudo de database/schema.sql no SQL Editor do Supabase
```

Preparar dados geobr e testar o seed sem gravar:

```bash
npm run seed -- --dry-run --limit=1 --delayMs=0
```

Gravar os municipios e amostras no Supabase:

```bash
npm run seed
```

## Rodar a aplicacao

Backend:

```bash
npm run dev
```

Frontend:

```bash
npm run serve:frontend
```

Abra `http://localhost:5173`.

Sem `DATABASE_URL`, a API ainda sobe e consulta SoilGrids por coordenada. Com `DATABASE_URL`, ela usa Supabase para municipios, intersecao espacial e cache de coordenadas.

## API

- `GET /health`
- `GET /api/municipios`
- `GET /api/solo?lat=-7.468361&lon=-37.669256`
- `GET /api/geocode?q=`

O frontend chama somente a API. Ele nao acessa Supabase diretamente.

## Deploy

### Supabase

1. Crie o projeto.
2. Rode `database/schema.sql`.
3. Configure `DATABASE_URL` no Render.
4. Rode `npm run seed` localmente ou por job controlado.

### Render

Use `render.yaml` ou crie um Web Service:

- Build: `npm install`
- Start: `npm start`
- Variaveis: `DATABASE_URL`, `DATABASE_SSL=true`, `CORS_ORIGIN=https://seu-front.vercel.app`

### Vercel

Configure:

- Build command: `npm run build:frontend`
- Output directory: `dist`
- Variavel: `API_BASE_URL=https://sua-api.onrender.com`

## Testes

```bash
npm test
```

Os testes cobrem conversao SoilGrids, classificacao de textura/fertilidade, consulta por coordenada, cache Supabase, serializacao de coordenadas e API.

## Observacoes

- Fertilidade e uma estimativa de prototipo baseada em pH, CEC, carbono organico e nitrogenio.
- Silte e derivado de `100 - areia - argila`.
- A API REST do SoilGrids pode ficar instavel; por isso a tabela `soil_point_cache` evita chamadas repetidas para a mesma coordenada.
- Nao ha CAR, cadastro de produtor, login ou dados privados.
