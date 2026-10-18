# Projeto GleysonSilva-Jarvis: OpenAI

O aplicativo usa Responses para conversa por texto e Realtime com WebRTC para fala. O modelo solicita ferramentas; o executor local valida argumentos, verifica a pasta autorizada, apresenta a confirmação necessária e registra o resultado. Uma resposta gerada pelo modelo não prova que uma ação aconteceu.

## Configuração

Abra **Ajustes**, informe sua chave de API no campo de senha e salve. Não envie a chave na conversa, não a inclua em capturas de tela e não crie arquivos de credenciais dentro do repositório. A interface informa apenas se existe uma chave configurada.

| Campo | Padrão | Observação |
| --- | --- | --- |
| Modelo de texto | `gpt-5.4-mini` | Responses, streaming e function calling. |
| Modelo de voz | `gpt-realtime` | Realtime GA, sem cabeçalhos ou eventos da API beta. |
| Voz | `marin` | Voz sintetizada padrão do provedor. |
| Limite da sessão | 10 minutos | O controlador local encerra a conexão ao atingir o prazo. |
| Perfil | `default` | Preferências salvas e execução são separadas por identificador. |

Os IDs são configuráveis. O catálogo do provedor e as permissões da conta podem mudar; a listagem autenticada de modelos confirma IDs visíveis à conta, sem garantir cada modalidade. A seleção de texto foi verificada na [página oficial GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini). O modelo de áudio segue o [schema oficial de criação de chamadas](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create).

O caminho de texto não gera voz por si só. Para ouvir a resposta natural transmitida pelo provedor, inicie a sessão de voz. Não há síntese escondida pelo navegador nem voz clonada nesta versão.

## Onde fica a chave

No **aplicativo Electron para Windows**, o processo principal usa `safeStorage`: a chave é cifrada pelo mecanismo do sistema, em arquivo privado da pasta de dados do aplicativo, fora do projeto. O renderer recebe a chave apenas no campo de configuração durante a digitação e a envia ao processo principal por uma interface limitada; ela não volta nas respostas de configuração, histórico ou eventos. Essa separação reduz exposição acidental; não protege contra um sistema operacional já comprometido. Se a proteção do sistema não estiver disponível, a gravação deve falhar de forma explícita.

O **modo local de teste no navegador**, iniciado com `npm run test:local` em `http://127.0.0.1:47832`, usa uma chave temporária em memória no servidor local. Não deve salvá-la em `localStorage`, página, bundle, URL ou arquivo. Fechar o processo exige configurar a chave novamente. Esse modo não demonstra persistência cifrada do Electron e não deve ser hospedado na rede. A prévia visual estática, sem bridge de teste, continua sendo apenas uma demonstração da interface.

O serviço OpenAI fala somente com `https://api.openai.com/v1`; a chave permanente aparece apenas no cabeçalho de autenticação dessas requisições. A inicialização de voz usa o fluxo [WebRTC com servidor intermediário](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime), que entrega ao renderer o SDP de resposta, sem entregar a chave.

## O que sai do dispositivo

No modo texto, o provedor recebe a solicitação, o histórico fornecido àquele turno, as preferências explícitas do perfil e os resultados de ferramentas necessários à continuação. Não envie conteúdo privado que não queira processar no serviço externo. A seleção da pasta limita o executor; não equivale a enviar automaticamente todos os arquivos.

Na sessão de voz, o microfone transmite áudio ao provedor enquanto a conexão estiver aberta, incluindo períodos em que a pessoa ainda não terminou de falar. Encerrar a sessão fecha tracks e conexão. A detecção de fim de fala e a transcrição em português fazem parte da configuração da sessão. Frames e vetores do reconhecimento facial local não são incluídos nos pedidos OpenAI.

As requisições Responses definem `store:false`. Isso evita depender da recuperação de respostas armazenadas para a continuação da tarefa e **não significa retenção zero** para todas as finalidades do provedor. Consulte os [controles de dados oficiais](https://developers.openai.com/api/docs/guides/your-data).

## Memória e aprendizagem

Preferências são salvas somente por ação explícita e revisável. Antes de responder ou abrir uma sessão de voz, o processo principal obtém `runtime.getSnapshot(profileId).memories`, seleciona apenas os textos e limita o contexto JSON a 8.000 caracteres. Esses textos são marcados como dados: não podem substituir políticas, aprovações ou ferramentas. O histórico enviado pelo renderer aceita apenas mensagens de usuário e assistente; não aceita mensagens de sistema.

Isso é memória recuperada entre sessões. Os pesos do modelo não são retreinados. Uma preferência editada ou apagada passa a valer em novas solicitações; encerre e reinicie a sessão de voz para atualizar o contexto que já foi enviado ao provedor. Trocar o perfil deve encerrar tarefas e conversas incompatíveis antes de carregar os novos dados.

Para continuar uma prévia em outro pedido, o backend também fornece os IDs de até três planos pendentes e três execuções recentes da pasta e perfil ativos. Isso permite reconhecer “aplique aquela prévia” sem depender de o ID aparecer na fala anterior. O contexto é atualizado a cada turno de Responses, limitado e marcado como dado não confiável. A sessão de voz recebe o estado inicial e continua pelos resultados reais de suas ferramentas. Nenhuma referência equivale a autorização; o executor revalida planos e arquivos antes de qualquer efeito ou restauração.

## Continuação, cancelamento e custos

O parser SSE aceita fragmentos UTF-8 divididos pela rede, comentários de heartbeat e eventos em vários chunks. Só uma resposta completada pode iniciar chamadas locais. As ferramentas são processadas em série, com no máximo seis turnos e doze chamadas por solicitação, sem repetição automática de efeitos. A continuação preserva itens completos, inclusive raciocínio cifrado quando fornecido, conforme o [fluxo de raciocínio sem armazenamento](https://developers.openai.com/api/docs/guides/reasoning).

Cancelar propaga um sinal ao transporte e ao executor. Uma solicitação tem prazo total padrão de três minutos, incluindo espera por confirmação. Uma autorização pendente expira junto com esse prazo. Interromper a fala ou desconectar não apaga efeitos que já foram confirmados; consulte o registro antes de repetir uma tarefa.

Responses reporta tokens acumulados por turno. O limite de tempo de voz e o limite de chamadas reduzem sessões acidentais, mas não são um teto monetário garantido. Configure os limites do projeto na plataforma e acompanhe o consumo. Não há valor de custo ou promessa de latência medidos sem uma sessão real com sua conta.

## Erros e diagnóstico

| Situação | Conduta |
| --- | --- |
| Chave ausente | Configure-a em Ajustes. Nenhuma requisição é enviada. |
| Credencial recusada | Confira a chave e o projeto; não copie o erro bruto para o chat. |
| Modelo ou recurso negado | Escolha um ID permitido e compatível na conta. |
| Limite ou saldo | Confira as configurações da plataforma e tente novamente depois. |
| Conexão interrompida | Revise efeitos locais concluídos antes de iniciar outro pedido. |
| Visão local ausente | Texto e voz continuam disponíveis; câmera/identificação têm requisitos separados. |

Os erros do serviço usam códigos e mensagens curtas em português. Corpos de erro do provedor, cabeçalhos de autenticação e exceções internas não são enviados ao renderer. A implementação e os testes se encontram em `packages/openai` e `tests/openai.test.mjs`.

## Voz personalizada e ElevenLabs

A sessão OpenAI da interface usa somente as vozes padrão listadas nas configurações, com `marin` como inicial. A referência local `reference.wav` e a distribuição de áudios gerados foram autorizadas pelo autor. O adaptador [ElevenLabs](elevenlabs.md) já oferece uma CLI de clonagem e geração de áudio com streaming, mas não está ligado à conversa da interface. A amostra permanece privada e ainda não há clonagem remota confirmada por um ID real nesta etapa.

Para usar uma voz baseada em gravação **dentro da OpenAI**, também seria necessário confirmar elegibilidade e cumprir o fluxo próprio de gravação separada de consentimento do provedor. A documentação [Custom voices](https://developers.openai.com/api/docs/guides/custom-voices) distingue vozes por descrição de vozes por gravação; nem todos os tipos são compatíveis com Realtime. Um `voice_id` ElevenLabs não é uma voz OpenAI e não pode ser colocado no campo de voz desta sessão. Cada provedor tem sua própria conta, transporte e configuração.

## Validação desta entrega

Os testes offline verificam streaming, segurança de erros, recuperação de preferências, ferramentas, cancelamento e timeout, incluindo autorização pendente. Eles não fazem requisições pagas e não comprovam qualidade de áudio, latência real, acesso de um modelo pela conta nem a cifragem nativa em um Electron não iniciado. Use o [plano de validação](test-plan.md) para registrar esses resultados separadamente.
