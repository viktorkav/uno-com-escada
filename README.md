# Uno com escada

> **Fork com modificações.** O projeto original é do [ViktorKav](https://github.com/viktorkav/uno-com-escada) (jogo gerado por Claude Fable 5.2 e Claude Opus 5.5, a partir do pedido do vídeo do canal [ViktorKav](https://www.youtube.com/@vkav)). As alterações deste fork foram feitas com autorização do autor, por [Mateus Machado](https://github.com/owens1822) com ajuda do Claude, e estão descritas em [Modificações deste fork](#modificações-deste-fork). Todo o crédito pelo jogo é do autor original.

**Um Fiat Uno Mille EP 1996, com uma escada de alumínio no teto, para pilotar num circuito de corrida, direto no navegador.**

São duas versões do mesmo jogo, feitas por dois modelos de IA a partir do mesmo pedido: uma pelo Claude Fable 5.2 e outra pelo Claude Opus 5.5. Cada versão é um único `index.html`. Carro, pista, mata, céu e som saem do código: nenhuma delas usa textura, modelo 3D, áudio gravado, engine ou biblioteca 3D.

![O Uno azul com a escada no teto contornando uma curva, visto pela câmera de TV](.github/screenshots/fable-tv.jpg)

O projeto nasceu num vídeo do canal [ViktorKav](https://www.youtube.com/@vkav) sobre como escrever um pedido para a IA. O material de apoio do vídeo está em [viktorkav.com.br/apoio/uno-com-escada](https://viktorkav.com.br/apoio/uno-com-escada/).

## Jogar

Pelo navegador, sem baixar nada:

- [Versão do Fable 5.2](https://viktorkav.com.br/apoio/uno-com-escada/fable/)
- [Versão do Opus 5.5](https://viktorkav.com.br/apoio/uno-com-escada/opus/)

Ou no seu computador:

1. Baixe [`fable/index.html`](fable/index.html) ou [`opus/index.html`](opus/index.html).
2. Abra o arquivo no **Chrome** ou no **Edge**, num computador.
3. Espere alguns segundos enquanto o circuito é montado e aperte **Começar**.

Não há nada para instalar, e a página funciona sem rede. Ela precisa de um navegador com **WebGPU**. O alvo do pedido foi um MacBook Pro M4 Max em 2560×1440; em máquina mais modesta, a taxa de quadros cai.

## As duas versões

| | Fable 5.2 | Opus 5.5 |
|---|---|---|
| Nome do jogo | Uno com escada | Mille EP |
| Circuito | Serra da Mata | Circuito da Serra |
| Tempo de trabalho | 7 h 12 min | 5 h |
| Rodadas do crítico visual | 8 | 11 |
| Defeitos graves na última rodada | 4 | 5 |
| Preço de API | US$ 347,64 | US$ 87,81 |
| Tamanho na entrega do teste | 546 KB | 338 KB |
| Tamanho com som e menu | 603 KB | 341 KB |

| Fable 5.2 | Opus 5.5 |
|---|---|
| ![Reta de largada na versão do Fable](.github/screenshots/fable-largada.jpg) | ![Pórtico de largada na versão do Opus](.github/screenshots/opus-largada.jpg) |
| ![Curva na versão do Fable](.github/screenshots/fable-curva.jpg) | ![Curva na versão do Opus](.github/screenshots/opus-curva.jpg) |

Os dois modelos rodaram em esforço alto, cada um com o crítico visual dele, sem limite de rodadas nem de tempo. **Nenhum dos dois fechou o critério de pronto:** o pedido só dava a tarefa por pronta quando o crítico não apontasse mais nada acima de defeito menor, e os dois ainda tinham defeito grave na última rodada. O Opus encerrou por conta própria na rodada 11, avisando que a tarefa não estava pronta. O Fable foi interrompido na rodada 8.

## Controles

Os dois jogos respondem aos mesmos comandos. A lista também aparece na tela de início.

| | Teclado | Controle |
|---|---|---|
| Acelerar | `W` ou `↑` | Gatilho direito |
| Frear e dar ré | `S` ou `↓` | Gatilho esquerdo |
| Fazer curvas | `A` `D` ou `←` `→` | Analógico esquerdo |
| Freio de mão | `Espaço` | `A` |
| Trocar a câmera | `C` | `Y` |
| Olhar para trás | Segurar `V` | Segurar `RB` |
| Devolver o carro à pista | `R` | `X` |
| Pausar e abrir o menu | `Esc` | `Start` |

| Ferramenta | Tecla |
|---|---|
| Ligar e desligar o som | `M` |
| Estatísticas de desempenho | `H` |
| Benchmark: a volta roteirizada de 60 s, com média e máximo no fim | `B` |
| Assistir à volta roteirizada | `F` |
| Poses fixas de câmera | `1` a `6` |

O câmbio é automático, e a volta conta quando o carro cruza a linha de largada. O som começa depois do primeiro clique.

## Como foi feito

A pasta [`pedidos`](pedidos) tem o texto que a IA recebeu, sem cortes:

| Arquivo | O que é |
|---|---|
| [`01-circuito.txt`](pedidos/01-circuito.txt) | O pedido do jogo. Prioridades em ordem, restrições, máquina-alvo, cena, três verificações (crítico visual, desempenho e controles) e o critério de pronto. Foi o mesmo texto para o Fable 5.2 e para o Opus 5.5. |
| [`02-som-e-menu.txt`](pedidos/02-som-e-menu.txt) | O pedido seguinte: controle, painel, tela de início, menu, benchmark e som sintetizado. Foi passado ao Fable 5.2 nos dois jogos, depois do teste. |
| [`03-ajustes.txt`](pedidos/03-ajustes.txt) | Três ajustes finais de texto e de volume. |

O crítico visual do primeiro pedido é um subagente novo a cada rodada, que vê só as imagens do jogo e as referências, nunca o código. As fotos do carro e as capturas usadas como referência de imagem não fazem parte deste repositório.

O molde do pedido vem do [Abyssal Garden](https://github.com/Noniv/abyssal-garden), do Noniv: um oceano 3D de 97 KB, feito do mesmo jeito.

## Mexer no código

O código legível de cada versão está na pasta `source` dela. Para mudar alguma coisa e montar o `index.html` de novo, basta o [Node.js](https://nodejs.org) 18 ou mais novo, sem instalar pacote nenhum:

```bash
node fable/source/build.mjs
node opus/source/build.mjs
```

Cada comando reescreve o `index.html` da versão.

**Versão do Fable** ([`fable/source`](fable/source)): os arquivos de `js/` entram na página na ordem do nome.

| Arquivo | O que tem dentro |
|---|---|
| `js/10_track.js` | O circuito: traçado, elevação e zonas. **Um bom lugar para começar.** |
| `js/30_car_*.js` | O Uno: a forma da carroceria, a pintura, as peças, o rack e a escada |
| `js/31_world.js`, `js/32_props.js` | Terreno, pista, guard-rails, arquibancada, boxes e pórtico |
| `js/33_veg_*.js` | A mata: árvores, grama e os impostores de longe |
| `js/40_vehicle.js` | A física do carro |
| `js/45_game.js` | Entrada, câmeras e a volta roteirizada |
| `js/50_som.js` | O som, sintetizado na hora |
| `js/51_painel.js`, `js/52_ui.js` | Painel, tela de início, menu e benchmark |
| `wgsl/` | Os shaders: materiais, céu, sombras, pós-processamento |

**Versão do Opus** ([`opus/source`](opus/source)):

| Arquivo | O que tem dentro |
|---|---|
| `js/track.js` | O circuito. **Um bom lugar para começar.** |
| `js/car_model.js`, `js/cargfx.js` | O Uno e as malhas dele na GPU |
| `js/world.js`, `js/terrain.js`, `js/vegetation.js` | Pista, terreno e mata |
| `js/physics.js` | A física do carro |
| `js/game.js` | Carga, laço principal, entrada e câmeras |
| `js/som.js` | O som, sintetizado na hora |
| `js/painel.js` | O painel do jogo |
| `js/renderer.js`, `shaders/` | O renderizador e os shaders |

## Modificações deste fork

Alterações só na versão do **Fable** (`fable/source` e o `fable/index.html` gerado a partir dela):

- **Câmeras:** a tecla `C` agora passa por 5 câmeras: perseguição nível 1 (a original), perseguição nível 2 (mais alta e mais distante), perseguição nível 3 (a mais alta, mirando mais à frente para mostrar o horizonte da pista), capô e TV. Os valores dos níveis ficam em `CHASE_LVS`, em `fable/source/js/45_game.js`.
- **Reiniciar a volta:** botão no menu do `Esc` que devolve o carro ao grid e zera cronômetro, última volta e avisos (a melhor volta fica salva).
- **Volta válida, inspirada nos limites de pista da F1:** a volta é invalidada se o jogador usar `R` (ou `X` no controle) para voltar à pista, se as quatro rodas ficarem fora do asfalto e da zebra, ou se a posição dá um salto grande ao longo da pista (atalho). A zebra pode. Volta inválida fica sem tempo, não vira melhor volta, e um aviso vermelho aparece no alto da tela.

## Licença

[PolyForm Noncommercial 1.0.0](LICENSE.md): livre para usar, estudar, mudar e compartilhar sem fim comercial.
