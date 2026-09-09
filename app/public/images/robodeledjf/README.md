# Landing page images

The current landing uses `hero-clean.png` as its AI-edited hero and photographic windows from `robot-experiences.png`, `event-types.png` and `event-effects.png` in the gallery. `team-poster.png` preserves the supplied reference. See `docs/media-assets.md` at the repository root for provenance. The filename suggestions below are retained as historical guidance only.

## Historical photo suggestions

Salve aqui as fotos do Instagram [@robodeledjf](https://www.instagram.com/robodeledjf/)
com exatamente estes nomes. A página inicial procura por eles:

| Arquivo                   | Onde aparece | Foto sugerida                                  |
| ------------------------- | ------------ | ---------------------------------------------- |
| `capa-robos-de-led.jpg`   | Hero         | Arte "ROBÔS DE LED" com o time todo            |
| `bumblebee.jpg`           | Galeria      | Bumblebee amarelo                              |
| `robo-verde.jpg`          | Galeria      | Robô verde com painel de LED                   |
| `robo-tequileiro.jpg`     | Galeria      | Robô tequileiro (quase 3 m)                    |
| `festa-noite.jpg`         | Galeria      | Robôs com o público em festa a céu aberto      |
| `criancas.jpg`            | Galeria      | Robôs com as crianças                          |
| `evento-empresarial.jpg`  | Galeria      | Robô com a equipe em evento de empresa         |

Recomendações:

- proporção vertical (4:5), por exemplo 1080x1350 px;
- até ~400 KB por foto, para a página carregar rápido;
- `.jpg` (se preferir `.webp`, ajuste os nomes em `src/pages/Landing.jsx`).

Enquanto um arquivo não existir, a página mostra um bloco decorativo no lugar da foto —
nada quebra. No hero, a ilustração de robô em SVG entra como reserva.
Para mudar legendas ou adicionar mais fotos, edite as listas `HERO_PHOTO` e `GALLERY`
em `app/src/pages/Landing.jsx`.
