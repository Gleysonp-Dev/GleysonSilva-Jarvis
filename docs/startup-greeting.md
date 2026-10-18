# Saudação de abertura

Quando a opção de saudação estiver ligada, o Jarvis prepara uma fala de abertura com o horário local do computador, o tempo na cidade configurada e a previsão de hoje. A última frase é exatamente: **“Em que posso ajudá-lo agora, senhor?”** Não há chamada a um LLM para escrever essa mensagem.

O serviço usa “Bom dia” das 06h às 11h59, “Boa tarde” das 12h às 17h59 e “Boa noite” nos demais horários. Hora e fuso vêm do computador. As coordenadas e o nome da cidade ficam na configuração privada; o repositório não traz a localização pessoal do autor.

## Voz e ativação

O backend exige `startupGreeting: true` antes de consultar tempo ou sintetizar fala. A saudação completa é gerada pela voz ElevenLabs configurada para aquela instalação; não é o MP3 fixo da demonstração. O autor ouviu e aprovou a narração de abertura com tempo/previsão gerada no painel. Para preservar essa escolha, o serviço usa **Eleven Multilingual v2**, estabilidade 0,5, similaridade 0,75, estilo 0, speaker boost ligado e velocidade 1, enviados explicitamente em cada síntese. O adaptador oferece Flash para outros usos, mas a abertura não troca automaticamente o modelo aprovado. Os campos seguem a [configuração oficial de voz](https://elevenlabs.io/docs/api-reference/voices/settings/update).

O tom metálico é fixo e aplicado localmente pelo Web Audio durante a reprodução da saudação e da amostra. Nesta revisão, ele ficou um pouco mais presente, e a reprodução passou a **0,95× com a altura da voz preservada**, apenas 5% mais lenta que a voz original. Não há fala adicional antes da narração nem controle de intensidade. O processamento não altera o clone, o MP3 de origem ou os parâmetros enviados à ElevenLabs: a velocidade de síntese continua em 1.

O autor ouviu e aprovou a versão anterior e pediu esse refinamento de timbre e cadência. A nova reprodução ainda precisa de confirmação auditiva própria; a aprovação anterior não é apresentada como aprovação desta revisão.

A execução automática completa ainda precisa de ensaio com a chave configurada no aplicativo. Aprovar a narração no painel confirma a escolha da voz; não comprova a consulta meteorológica ou a reprodução automática em uma nova instalação.

A integração usa uma chave ElevenLabs própria, preenchida no campo mascarado das configurações, sem enviá-la à conversa. Acesso ao painel pelo navegador não fornece essa chave automaticamente. Sem chave, o serviço retorna o texto e `reason: requires_key`, com `audioBase64: null`; não simula uma resposta falada. Voz ausente ou erro de síntese também preservam o texto e informam a causa de disponibilidade.

O controlador principal aplica início único, limite de repetição, cancelamento ao mudar ou encerrar a sessão e descarte de resultados antigos. Preparar um áudio não deve ativar o microfone. A interface inicia a reprodução conforme a configuração de abertura; se o navegador exigir um gesto, deve oferecer um controle explícito para ouvir. Interromper precisa parar o áudio e sua pulsação.

## Tempo e previsão

A consulta usa somente o endpoint HTTPS fixo `https://api.open-meteo.com/v1/forecast`, sem chave de tempo. São solicitadas temperatura atual, condição WMO, mínima/máxima do dia e probabilidade máxima de precipitação. As condições atuais são dados de modelo meteorológico, não uma medição de um sensor do computador. A [documentação Open-Meteo](https://open-meteo.com/en/docs) descreve variáveis, fusos e timestamps.

O serviço usa timestamps Unix e valida o dia no fuso enviado pelo computador. Rejeita condição desconhecida, temperatura/unidade inválida, previsão de outro dia, dados atuais com mais de três horas ou mais de quinze minutos no futuro. A probabilidade só é falada se estiver presente, em porcentagem válida. Se faltar consulta ou dado válido, informa **“Não consegui consultar o tempo agora.”** e mantém a pergunta final. Não inventa valores.

O prazo da consulta é de oito segundos. Somente o resumo validado fica em cache de memória por até dez minutos, vinculado às coordenadas exatas, ao fuso e à data. Não há histórico completo de tempo salvo em arquivos. A síntese tem prazo de vinte segundos, texto até 600 caracteres e áudio em memória até 2 MiB, sem gravação automática em disco.

## Atribuição e uso do serviço

Quando utiliza dados válidos, o resultado inclui atribuição para a interface exibir: **Dados Open-Meteo (CC BY 4.0), resumidos em português**, com link para a fonte e licença. Isso também informa que os dados foram transformados em uma síntese textual. [Licença dos dados](https://open-meteo.com/en/licence).

O endpoint gratuito utilizado nesta implementação é destinado a uso **não comercial**, sujeito aos limites do serviço. Uma futura oferta comercial precisa rever o plano e o endpoint apropriados; a licença dos dados e as condições de acesso à API são questões distintas. [Termos da API gratuita](https://open-meteo.com/en/terms).

## Contrato e verificação

`StartupGreetingService` está em `packages/greeting/index.mjs`. Recebe `getSettings`, `getKey` da ElevenLabs e, opcionalmente, transporte/relógio/cliente de síntese para testes. `prepare({hour,timezone},{signal})` devolve texto, estado do tempo, nome de apresentação, MP3 em base64 ou `null`, razão de indisponibilidade e atribuição quando aplicável. Chave, ID de voz e coordenadas não aparecem nesse retorno.

Os testes em `tests/greeting.test.mjs` usam cidades e coordenadas sintéticas. Cobrem faixas do dia, frase final, datas/frescor/unidades, endpoint fixo, falhas, cache, chave ausente, síntese, limites e cancelamento. Esses testes não consultam tempo real nem geram cobrança. A abertura automática, reprodução audível e qualidade da fala precisam de ensaio integrado, com a configuração privada do usuário.
