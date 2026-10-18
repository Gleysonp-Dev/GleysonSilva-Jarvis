# Provedor OpenAI

Serviço ESM para o processo principal do Electron, usando `fetch` nativo sem SDK adicional. A chave permanente entra somente por `getKey`, permanece em campos privados e cabeçalhos de solicitações para `https://api.openai.com`, e nunca é devolvida pela interface pública.

Os padrões são `gpt-5.4-mini` para texto e `gpt-realtime` para entrada falada e resposta em texto. A narração do aplicativo usa ElevenLabs; a saída de áudio OpenAI permanece desativada. São IDs configuráveis; a disponibilidade de cada modelo e os limites dependem da conta. `listModels()` autentica no endpoint de modelos e retorna somente IDs válidos. Um ID listado não garante que todo recurso ou modalidade esteja disponível para a conta.

## Contrato

`new OpenAIService({getKey,getSettings,runtime,onEvent,fetch?})` recebe as funções do processo principal. A função `getSettings` fornece `{textModel,realtimeModel,maxSessionMinutes}`; a duração máxima de uma sessão é aplicada pelo controlador de voz ao fechar a conexão, porque não é uma propriedade de criação Realtime. A opção `fetch` permite testes sem rede. Não exponha a instância, `getKey` nem cabeçalhos via IPC.

`respond({text,history=[],profileId='default',runId},{signal?})` usa Responses SSE progressivo, com `store:false`, ferramentas estritas, execução serial e até seis turnos de ferramentas (doze chamadas no total). Preserva os itens completos de saída, inclusive raciocínio cifrado quando fornecido, e resultados tipados para continuação sem `previous_response_id`. Não executa ferramentas de fluxos que encerraram antes de `response.completed`. O cancelamento é propagado ao `fetch`, leitor SSE e runtime; o timeout total padrão é de três minutos, incluindo espera por aprovação. Não há repetição automática de requisições que possam envolver ações.

O histórico aceita somente mensagens de usuário e assistente com texto. Regras do sistema, chaves e perfis não vêm de mensagens fornecidas pelo renderer. Os eventos são `{type:'text.delta',runId,delta}`, `{type:'text.done',runId,text,usage}`, `{type:'state',runId,state:'thinking'|'executing'|'idle'}` e `{type:'error',runId,error:{code,message}}`. A resposta final também retorna `{text,usage}`. O consumo soma os tokens reportados em todos os turnos; não estima preços nem afirma limites de gastos. `store:false` não é garantia de retenção zero nos sistemas do provedor.

Antes de cada solicitação de texto ou criação de sessão Realtime, o serviço obtém `runtime.getSnapshot(profileId).memories` pelo backend. Somente os campos `text` são incluídos, como um bloco de dados JSON com até 8.000 caracteres e instrução explícita de que não alteram política, ferramentas ou autorizações. Um runtime sem `getSnapshot` ou sem memórias usa contexto vazio; dados de outro perfil não são recuperados. Alterar a memória exige nova sessão de voz para atualizar o contexto já enviado.

`runtime.getPlanContext(profileId)` fornece continuidade entre pedidos como “mostre a prévia” e “aplique aquela”. Antes de cada turno enviado a Responses e na criação de uma sessão Realtime, o serviço recupera até três prévias pendentes e três referências de efeitos recentes da pasta e perfil atuais. A lista usa campos permitidos, caminhos relativos e até 8.000 caracteres; amostras de passos truncadas são marcadas. IDs continuam disponíveis mesmo quando o histórico de conversa só contém mensagens. Esses dados não concedem autorização: aplicação e restauração continuam validadas pelo executor. Efeitos recentes representam a última verificação no registro, não uma garantia sobre o arquivo atual.

`createRealtimeSession({sdp,profileId},{signal?})` envia multipart `sdp` e `session` ao endpoint `/v1/realtime/calls`, mantendo a chave no processo principal. Retorna `{sdp,tools,sessionId?}`; o ID opcional vem do cabeçalho `Location`. O renderer usa apenas o SDP para concluir seu `RTCPeerConnection`. Áudio WebRTC negocia o formato e não usa eventos PCM manuais. A sessão configura VAD com interrupção, transcrição em português, ferramentas locais e `output_modalities: ['text']`. As frases de texto passam pelo serviço ElevenLabs e pelo processamento local aprovado. Tracks remotas inesperadas não são reproduzidas. Limites de tempo e encerramento precisam ser aplicados pelo controlador local, não pelo prompt.

`executeRealtimeTool({id,name,args,profileId,runId},{signal?})` passa pelo mesmo runtime tipado e política de aprovação de texto. O controlador precisa vincular perfil e chamada à sessão ativa, serializar chamadas, deduplicar `call_id` e rejeitar resultados de gerações encerradas antes de enviar `function_call_output` ao canal Realtime.

O runtime oferece `toolDefinitions` no formato flat da Responses API e `call({id,name,args,profileId,runId},{signal})`, retornando `{ok,status:'verified'|'failed'|'cancelled',summary,data?}`. O processo principal conserva o controle de aprovação e validação de argumentos. O modelo nunca recebe autorização por conta própria.

## Fontes verificadas

Implementação baseada na documentação oficial OpenAI consultada em 18 de outubro de 2026:

- [GPT-5.4 Mini: Responses, streaming e ferramentas](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
- [Resposta transmitida por SSE](https://developers.openai.com/api/docs/guides/streaming-responses).
- [Function calling e esquemas estritos](https://developers.openai.com/api/docs/guides/function-calling).
- [Raciocínio e continuação sem respostas armazenadas](https://developers.openai.com/api/docs/guides/reasoning).
- [WebRTC e inicialização unificada Realtime](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime).
- [Schema do endpoint de criação de chamadas](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create).
- [Modelo GPT-Realtime](https://developers.openai.com/api/docs/models/gpt-realtime).

Os testes mock cobrem protocolo, fragmentos UTF-8, ferramentas, interrupção, timeout e erros sem revelar credenciais. Os testes automáticos não fazem requisições pagas. Houve ensaio separado com conta real; resultados e limites estão em [Validação](../../docs/validation.md). Não há benchmark de latência de produção.
