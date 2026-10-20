# Contexto sob demanda — revisão 0.3.0

Contexto é o primeiro passo do briefing com fontes reais: um painel de leitura aberto pelo botão **Contexto** na barra lateral. O dashboard permanece sem cartões automáticos, boletins escritos ou transcrições. Abrir o painel não liga microfone/câmera, não produz áudio e não chama OpenAI ou ElevenLabs.

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
| Registro local do Jarvis | Estado e horário de execuções do perfil: em andamento, aguardando decisão, concluídas, falhas, canceladas e interrompidas. | Snapshot de até 100 execuções recentes; lista de até oito. A contagem não representa todo o histórico ilimitado. |

Atividade local não é agenda, lista de compromissos, consulta ao Google ou detecção das aplicações abertas. Ela resume execuções que o próprio Jarvis registrou. Uma fonte indisponível recebe estado explícito, sem impedir a apresentação da outra fonte disponível.

O painel evita incluir argumentos das ferramentas, conteúdo dos arquivos e memórias no resumo. Mostra rótulos de ações conhecidos, estados e horários; o registro completo permanece no painel próprio.

## Horários, validação e cache meteorológico

- **Observação:** horário informado pela fonte para as condições atuais.
- **Consultado na fonte:** momento em que a resposta foi obtida.
- **Em cache:** resposta reutilizada, com horário de obtenção e vencimento visíveis.
- **Consulta:** horário em que o conjunto exibido no painel foi preparado.

O cache meteorológico é em memória e dura até **dez minutos**. A chave inclui coordenadas, fuso e data local; mudar cidade/fuso ou atravessar a data impede reutilizar a entrada anterior. A observação precisa continuar válida: até **três horas de idade**, com tolerância de até quinze minutos no futuro para diferença de relógio. O relógio não pode retroceder para antes da obtenção e reaproveitar silenciosamente o cache.

A resposta valida unidades Celsius, códigos conhecidos de condição, temperaturas finitas em faixas aceitas, mínima menor ou igual à máxima e previsão da data local solicitada. Chance de chuva só aparece se estiver entre 0 e 100 e vier em porcentagem. Respostas fora dessas condições são indisponíveis. Essa validação de formato e atualidade não comprova precisão meteorológica no local do usuário.

O painel identifica a [Open-Meteo](https://open-meteo.com/) e mantém atribuição [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A consulta envia as coordenadas configuradas ao serviço meteorológico; não pede geolocalização ao navegador.

## Cancelamento e isolamento do perfil

A bridge permite uma leitura controlada e seu cancelamento. Fechar o painel ou a janela cancela a consulta; mudar perfil invalida o resultado e abre uma leitura no perfil novo quando necessário. A interface usa uma geração de consulta para ignorar conclusões atrasadas. O serviço verifica o perfil ao iniciar e antes de entregar o resultado, e limita a espera pelas fontes.

A atividade é lida exclusivamente para o perfil ativo. Clima e atividade são consultas de leitura: não executam ferramentas, não criam tarefas, não guardam memórias e não narram resultados. Não há atualização contínua ou anúncio automático do painel.

## Núcleo orbital

O núcleo da 0.3.0 é um desenho original em Canvas inspirado na estética orbital das demonstrações públicas de Lucas Victor. Não reutiliza seus assets ou código. Filamentos e realces azuis contornam um centro vazio; não há texto central, grade ou anel mecânico segmentado.

O microfone e o áudio reproduzido controlam brilho e expansão, com suavização de ataque/liberação. Execução e preparação têm cadências próprias, sempre na mesma cor. O desenho limita atualização a 30 fps nos estados ativos e 15 fps em espera; resolução adaptativa e redução de DPI controlam o custo. Com movimento reduzido, a geometria permanece estática. RAF, observador de tamanho e listener de preferência são liberados no encerramento do componente.

A voz aprovada permanece com velocidade **0,95×**, altura preservada e efeito metálico fixo **0,78**. A mudança visual e o painel não introduzem uma voz alternativa.

## Próxima fase e validação

Google Calendar, agenda, e-mail, notícias e resumo falado combinado **ainda não estão implementados**. Exigem conectores, autorização e testes próprios antes de aparecer como fontes. Não apresentar dados fictícios dessas integrações nem solicitar permissões como parte desta revisão.

A base 0.2.3 teve 229 testes e abertura nativa aprovados no CI. A 0.3.0 está em verificação; os resultados históricos não validam o novo painel ou núcleo no hardware do usuário. Registrar separadamente testes automáticos, inspeção visual com serviços substituídos, consulta real, uso do áudio e abertura do pacote. Detalhes históricos em [Validação](validation.md) e instalação em [AI_INSTALL.md](../AI_INSTALL.md).
