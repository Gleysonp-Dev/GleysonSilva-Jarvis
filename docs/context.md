# Contexto e fontes sob demanda — revisão 0.4.0

Contexto é o primeiro passo do briefing com fontes reais: um painel de leitura aberto pelo botão **Contexto** na barra lateral. O dashboard permanece sem cartões automáticos, boletins escritos ou transcrições. Abrir o painel não liga microfone/câmera, não produz áudio e não chama OpenAI ou ElevenLabs.

A 0.4.0 preserva o painel e o núcleo 0.3.1 aprovado pelo autor. Acrescenta uma faixa compacta de fontes após consultas explícitas à web/pesquisa/clima, sem abrir cartões ou transcrever a fala. CI e pacote da 0.4.0 estão pendentes. O [CI histórico bfcc67b9 da base 0.3.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787) aprovou 264/264 testes, zero falhas/skips, TypeScript, build, pacote e abertura nativa real em 20 de outubro de 2026, às 20h14, America/New_York; não comprova as ferramentas novas. Veja [Aplicativos, pastas, web e clima](desktop-access.md).

## Usar

1. Abra **Contexto** para consultar as fontes disponíveis.
2. Sem cidade, use **Configurar cidade** e informe nome/coordenadas privadamente em Ajustes.
3. Consulte **Tempo** e **Atividade local**, com seus horários e estados.
4. Use **Atualizar** para outra leitura. Uma resposta meteorológica ainda válida pode vir do cache.
5. Feche o painel para voltar à tela principal. **Abrir registro** mostra o histórico detalhado das ações.

Uma cidade configurada é suficiente para o clima. Essa consulta funciona com `startupGreeting` desligado e sem chave ElevenLabs ou OpenAI. A geração da saudação continua sendo outro fluxo, que precisa da voz e de sua configuração privada.

## Fontes e alcance

| Fonte | Dados apresentados | Limite |
| --- | --- | --- |
| Open-Meteo | Temperatura atual, condição em português, mínima/máxima de hoje e probabilidade de chuva quando válida. | A localização vem da configuração privada. Resposta inválida ou indisponível não é substituída por estimativa. |
| Registro local do Jarvis | Estado e horário de execuções do perfil: em andamento, aguardando decisão, concluídas, enviadas ao Windows sem verificação da janela, falhas, canceladas e interrompidas. | Snapshot de até 100 execuções recentes; lista de até oito. A contagem não representa todo o histórico ilimitado. |

Atividade local não é agenda, lista de compromissos, consulta ao Google ou detecção das aplicações abertas. Ela resume execuções que o próprio Jarvis registrou. Uma fonte indisponível recebe estado explícito, sem impedir a apresentação da outra fonte disponível.

O painel evita incluir argumentos das ferramentas, conteúdo dos arquivos e memórias no resumo. Mostra rótulos de ações conhecidos, estados e horários; o registro completo permanece no painel próprio.

**Enviada ao Windows** corresponde ao resultado `unverified`: o pedido de abertura foi despachado, mas a janela não foi verificada. Essas execuções têm contagem própria e não são somadas como conclusões verificadas.

## Horários, validação e cache meteorológico

- **Observação:** horário informado pela fonte para as condições atuais.
- **Consultado na fonte:** momento em que a resposta foi obtida.
- **Em cache:** resposta reutilizada, com horário de obtenção e vencimento visíveis.
- **Consulta:** horário em que o conjunto exibido no painel foi preparado.

O cache meteorológico é em memória e dura até **dez minutos**. A chave inclui coordenadas, fuso e data local; mudar cidade/fuso ou atravessar a data impede reutilizar a entrada anterior. A observação precisa continuar válida: até **três horas de idade**, com tolerância de até quinze minutos no futuro para diferença de relógio. O relógio não pode retroceder para antes da obtenção e reaproveitar silenciosamente o cache.

A resposta valida unidades Celsius, códigos conhecidos de condição, temperaturas finitas em faixas aceitas, mínima menor ou igual à máxima e previsão da data local solicitada. Chance de chuva só aparece se estiver entre 0 e 100 e vier em porcentagem. Respostas fora dessas condições são indisponíveis. Essa validação de formato e atualidade não comprova precisão meteorológica no local do usuário.

O painel identifica a [Open-Meteo](https://open-meteo.com/) e mantém atribuição [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A consulta envia as coordenadas configuradas ao serviço meteorológico; não pede geolocalização ao navegador.

Uma pergunta explícita sobre o tempo atual pode usar `weather_current`, que força nova leitura da cidade configurada, sem preparar TTS, música ou captura. Se essa atualização falhar, não recorre a previsão antiga apresentada como atual. Essa ferramenta é separada do painel/saudação, que mantêm a política de cache descrita acima.

## Fontes de uma consulta por texto ou voz

Na 0.4.0, `web_read`, `web_search` e `weather_current` podem devolver até seis fontes em uma faixa compacta fora do log de mensagens. Cada link mostra título e domínio; a faixa informa o horário da consulta. A resposta falada continua oculta no painel Conversa. A consulta não abre o Contexto ou um cartão automaticamente.

Os links permanecem até a próxima consulta trazer fontes, ou até o usuário usar **Ocultar fontes**. Reset e troca de perfil limpam a faixa. A interface limita títulos/URLs, aceita somente HTTP(S) sem credenciais/controles e não deixa execuções antigas/canceladas substituir uma consulta mais recente. No aplicativo, o endereço é aberto pela integração externa validada.

Leitura de página, pesquisa e abertura no navegador exigem suas confirmações por operação. O leitor não usa JavaScript, login ou cookies. A pesquisa hospedada OpenAI usa a chave/modelo existentes e pode consumir a conta; sua subconsulta não inclui histórico ou memórias. Esses fluxos não tornam o painel Contexto uma consulta automática ou uma autorização para navegar/agir. Veja [o guia completo](desktop-access.md).

## Cancelamento e isolamento do perfil

A bridge permite uma leitura controlada e seu cancelamento. Fechar o painel ou a janela cancela a consulta; mudar perfil invalida o resultado e abre uma leitura no perfil novo quando necessário. A interface usa uma geração de consulta para ignorar conclusões atrasadas. O serviço verifica o perfil ao iniciar e antes de entregar o resultado, e limita a espera pelas fontes.

A atividade é lida exclusivamente para o perfil ativo. Clima e atividade são consultas de leitura: não executam ferramentas, não criam tarefas, não guardam memórias e não narram resultados. Não há atualização contínua ou anúncio automático do painel.

## Núcleo orbital

O núcleo da 0.3.1 é um desenho original em Canvas revisto a partir do vídeo específico fornecido pelo autor. Usa dez curvas de intensidades distintas, deformação assimétrica, fios ciano e focos luminosos sobre um campo azul com grade plana ampla. O centro não contém texto novo nem objeto sólido e deixa o fundo visível; não há anel mecânico segmentado. A paleta ciano/azul permanece fixa em todos os estados. A [nota de referência visual](research/referencia-video-nucleo.md) registra os quadros examinados e os limites da comparação. Não há reutilização dos assets ou do código do produto de referência.

O microfone e o áudio reproduzido controlam brilho e expansão, com suavização de ataque/liberação. Execução e preparação têm cadências próprias, sempre na mesma cor. O desenho limita atualização a 30 fps nos estados ativos e 15 fps em espera; resolução adaptativa e redução de DPI controlam o custo. Com movimento reduzido, a geometria permanece estática. RAF, observador de tamanho e listener de preferência são liberados no encerramento do componente.

A voz aprovada permanece com velocidade **0,95×**, altura preservada e efeito metálico fixo **0,78**. A mudança visual e o painel não introduzem uma voz alternativa.

## Próxima fase e validação

Google Calendar, agenda, e-mail, feed próprio de notícias e resumo combinado **ainda não estão implementados**. Pesquisa web pública pode buscar informações atuais, mas não equivale a esses conectores de conta. Eles exigem autorização e testes próprios antes de aparecer como fontes. eWeLink e Home Assistant, mostrados ou listados no vídeo, não fazem parte do uso atual do autor e permanecem como expansão futura. Nenhum desses conectores foi adicionado à 0.4.0. Não apresentar dados fictícios dessas integrações nem solicitar permissões como parte desta revisão.

A revisão anterior 0.3.0 teve **264 testes**, TypeScript, build, pacote e abertura nativa real aprovados no [CI b032bd3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678). A inspeção visual usou serviços substituídos e dados simulados identificados. Uma consulta real à fonte meteorológica ficou indisponível por resolução de rede. Posteriormente, o usuário relatou funcionamento no roteiro funcional curto e aprovou a parte funcional da 0.3.0, mas reprovou o núcleo. Esse relato não discrimina todos os dados meteorológicos, dispositivos ou cenários e não valida a nova composição.

A base 0.3.1 teve **264/264 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real aprovados no [CI bfcc67b9](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787). O [pacote 0.3.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787/artifacts/12310612279) foi baixado; ZIP e EXE tiveram seus hashes conferidos. O autor aprovou o núcleo visual. CI, pacote e ensaios reais das ferramentas da 0.4.0 permanecem pendentes. Registrar separadamente esses resultados, uso do áudio e ensaio físico; não há release assinada. Detalhes em [Validação](validation.md) e instalação em [AI_INSTALL.md](../AI_INSTALL.md).
