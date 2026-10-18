# Saudação de abertura

Quando a saudação é solicitada, o Jarvis prepara uma fala com o horário local do computador, o tempo na cidade configurada e a previsão de hoje. A última frase é exatamente: **“Em que posso ajudá-lo agora, senhor?”** Não há chamada a um LLM para escrever essa mensagem.

Com abertura automática habilitada e configuração completa, a interface pode preparar a recepção ao iniciar. Na revisão 0.2.0, **espera habilitada muda o início para aguardar “Jarvis” ou duas palmas**, antes da recepção; habilitar espera mantém a saudação ativa. Iniciar no Windows é opção para depois do login, não antes dele. Veja [Espera e login](standby.md).

O serviço usa “Bom dia” das 06h às 11h59, “Boa tarde” das 12h às 17h59 e “Boa noite” nos demais horários. Hora e fuso vêm do computador. As coordenadas e o nome da cidade ficam na configuração privada; o repositório não traz a localização pessoal do autor.

## Voz e ativação

O backend exige `startupGreeting: true` antes de consultar tempo ou sintetizar fala. A saudação completa é gerada pela voz ElevenLabs configurada para aquela instalação; não é o MP3 fixo da demonstração. O autor ouviu e aprovou a narração de abertura com tempo/previsão gerada no painel. Para preservar essa escolha, o serviço usa **Eleven Multilingual v2**, estabilidade 0,5, similaridade 0,75, estilo 0, speaker boost ligado e velocidade 1, enviados explicitamente em cada síntese. O adaptador oferece Flash para outros usos, mas a abertura não troca automaticamente o modelo aprovado. Os campos seguem a [configuração oficial de voz](https://elevenlabs.io/docs/api-reference/voices/settings/update).

O tom metálico é fixo no preset **0,78**, aplicado localmente pelo Web Audio. A reprodução é **0,95× com a altura da voz preservada**, 5% mais lenta que a origem, sem controle de intensidade. Não altera o clone, o MP3 original ou os parâmetros ElevenLabs: a velocidade de síntese continua em 1. A nova conversa usa o mesmo preset; seu aceite real completo ainda está pendente.

A velocidade de reprodução de 0,95× foi ouvida e aprovada pelo autor. A saudação completa é um fluxo distinto da frase de apresentação disponível em **Ajustes → Saudação → Amostra fixa da voz**.

A saudação com clima/atribuição foi exibida no ensaio local, e a narração completa foi ouvida e aprovada. Isso não comprova início automático em nova instalação, ativação por palmas/palavra ou entrada na conta Windows; esses ensaios continuam pendentes.

A integração usa uma chave ElevenLabs própria, preenchida no campo mascarado das configurações, sem enviá-la à conversa. Acesso ao painel pelo navegador não fornece essa chave automaticamente. Sem chave, o serviço retorna o texto e `reason: requires_key`, com `audioBase64: null`; não simula uma resposta falada. Voz ausente ou erro de síntese também preservam o texto e informam a causa de disponibilidade.

O controlador aplica início único, limite de repetição, cancelamento ao mudar/encerrar e descarte de resultados antigos. Cancelar a recepção também aborta a síntese pendente no backend. Preparar o áudio não abre uma conversa de microfone. Se o navegador exigir gesto, **Ouvir saudação** toca o áudio já preparado sem nova consulta/síntese. Interromper precisa parar som e pulsação.

A espera local deve pausar antes da narração e de eventual música, retomando apenas se ainda habilitada. A música depende de arquivo privado fornecido pelo usuário e termina com a saudação ou interrupção. **Nenhuma trilha padrão está incluída; o arquivo ainda não foi fornecido no ensaio registrado.**

## Tempo e previsão

A consulta usa somente o endpoint HTTPS fixo `https://api.open-meteo.com/v1/forecast`, sem chave de tempo. São solicitadas temperatura atual, condição WMO, mínima/máxima do dia e probabilidade máxima de precipitação. As condições atuais são dados de modelo meteorológico, não uma medição de um sensor do computador. A [documentação Open-Meteo](https://open-meteo.com/en/docs) descreve variáveis, fusos e timestamps.

O serviço usa timestamps Unix e valida o dia no fuso enviado pelo computador. Rejeita condição desconhecida, temperatura/unidade inválida, previsão de outro dia, dados atuais com mais de três horas ou mais de quinze minutos no futuro. A probabilidade só é falada se estiver presente, em porcentagem válida. Se faltar consulta ou dado válido, informa **“Não consegui consultar o tempo agora.”** e mantém a pergunta final. Não inventa valores.

O prazo da consulta é de oito segundos. Somente o resumo validado fica em cache de memória por até dez minutos, vinculado às coordenadas exatas, ao fuso e à data. Não há histórico completo de tempo salvo em arquivos. A síntese tem prazo de vinte segundos, texto até 600 caracteres e áudio em memória até 2 MiB, sem gravação automática em disco.

## Atribuição e uso do serviço

Quando utiliza dados válidos, o resultado inclui atribuição para a interface exibir: **Dados Open-Meteo (CC BY 4.0), resumidos em português**, com link para a fonte e licença. Isso também informa que os dados foram transformados em uma síntese textual. [Licença dos dados](https://open-meteo.com/en/licence).

O endpoint gratuito utilizado nesta implementação é destinado a uso **não comercial**, sujeito aos limites do serviço. Uma futura oferta comercial precisa rever o plano e o endpoint apropriados; a licença dos dados e as condições de acesso à API são questões distintas. [Termos da API gratuita](https://open-meteo.com/en/terms).

## Contrato e verificação

`StartupGreetingService` está em `packages/greeting/index.mjs`. Recebe `getSettings`, `getKey` da ElevenLabs e, opcionalmente, transporte/relógio/cliente de síntese para testes. `prepare({hour,timezone},{signal})` devolve texto, estado do tempo, nome de apresentação, MP3 em base64 ou `null`, razão de indisponibilidade e atribuição quando aplicável. Chave, ID de voz e coordenadas não aparecem nesse retorno.

Os testes em `tests/greeting.test.mjs` usam cidades/coordenadas sintéticas e cobrem horário, frase final, frescor/unidades, endpoint, falhas, cache, ausência de chave, síntese, limites e cancelamento. Não consultam clima real nem geram cobrança. A narração aprovada e o ensaio de clima estão registrados separadamente em [Validação](validation.md); login, ativação/retorno e música continuam exigindo ensaio integrado.
