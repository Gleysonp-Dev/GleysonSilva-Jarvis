# Projeto GleysonSilva-Jarvis: validação e critérios de lançamento

Este plano distingue verificações automáticas sem rede de ensaios com o Windows, dispositivos e uma conta OpenAI. Passar nos testes offline não comprova latência, reconhecimento facial, som audível ou funcionamento de um executável empacotado.

## Testes automáticos

Na raiz do projeto, use Node 24 ou superior:

```text
npm test
npm run check
npm run build
```

`npm run verify` reúne essas três verificações. Quando Python não estiver no caminho, a suíte opcional de visão informa skip. Para executá-la, defina `JARVIS_PYTHON` com o caminho do interpretador local ou use:

```text
python -I -B -m unittest discover -s services/vision -p "test_*.py"
```

Não é necessário instalar OpenCV ou baixar modelos para os testes de protocolo e pré-processamento: o backend é substituído por uma implementação de teste. A execução real da rede neural é uma verificação separada.

| Camada | Cobertura automática | Limite da evidência |
| --- | --- | --- |
| OpenAI SSE | Deltas progressivos, fragmentos UTF-8, heartbeats, JSON inválido, resposta incompleta e uso de tokens. | Respostas de rede simuladas; não mede um modelo. |
| Ferramentas via modelo | Continuação com itens completos, chamadas conhecidas, argumentos JSON, IDs repetidos e limite de turnos. | Valida protocolo e delegação; não comprova software externo. |
| Interrupção | Abort chega a transporte e runtime, inclusive aprovação pendente; não ocorre novo turno após cancelamento/timeout. | Efeitos já realizados dependem do registro do executor. |
| Contexto de memória | Recuperação pelo perfil backend, limite de 8.000 caracteres e marcação como dado não confiável. | Não é treino de pesos nem defesa perfeita de linguagem natural; a política de ferramentas é a barreira efetiva. |
| Continuidade de prévias | Um novo pedido recupera `planId` do backend, sem depender de IDs no texto; contexto limitado, isolamento de perfil e cancelamento antes de envio. | Referências não autorizam execução; planos, pasta e arquivos são revalidados pelo executor. |
| Erros e chave | Falta de chave não abre rede; erros HTTP, transporte e ferramenta não ecoam a credencial de teste. | Credencial usada apenas no teste; não demonstra DPAPI real. |
| Realtime | FormData/SDP, schema GA, voz, VAD com interrupção, ferramentas e identificador opaco opcional. | Não cria uma chamada paga e não captura áudio. |
| Visão Python | Rejeição de formatos, dimensões antes de decode, ausência opcional de modelos, cinco pontos antes de feature e normalização. | Backend falso; não mede detecção ou identificação reais. |
| Executor local | Consulte `tests/runtime.test.mjs` para política, caminhos, estado e resultados verificados. | Verifique quais adaptadores do sistema foram substituídos antes de interpretar o resultado. |

O desenvolvimento inicial validou os testes do provider com `fetch` falso e os testes Python com o interpretador empacotado do ambiente de trabalho. Nenhuma chamada paga foi necessária. Contagens finais e evidências da integração devem ser registradas no resultado da execução, sem substituir os limites descritos nesta tabela.

## Ambiente de ensaio

Use uma pasta descartável fora da pasta privada de dados. Prepare arquivos de extensões diferentes, datas do mês atual e do mês anterior, um arquivo alterado após a prévia, um conflito de destino e um link ou junção de teste. Não escolha Documentos ou Downloads reais para o primeiro ensaio.

Registre versão do Windows, CPU, memória, modelo de câmera, microfone, saída de áudio, navegador/Electron e versões do app e modelos. Diferencie três superfícies: prévia visual estática, harness local no navegador e aplicativo Electron. O harness local usa chave em memória; não conta como teste de persistência do armazenamento protegido do Windows.

Para o harness, inicie `npm run test:local` e abra `http://127.0.0.1:47832`. O servidor escuta somente loopback e a bridge valida token/origem. A pasta de testes é `local-data/workspace`, gerada pelo próprio harness e excluída do Git. Abrir aplicativos do Windows fica indisponível nesse modo. `npm run preview` continua sendo uma prévia visual sem esses serviços locais.

## Execução local e correção durante tarefa

1. Escolha a pasta de ensaio e peça a prévia de organização. Sem confirmação, nenhum arquivo deve mover.
2. Corrija o filtro para o mês atual, compare a nova lista e só então autorize. Verifique cada origem e destino no registro e no sistema de arquivos.
3. Interrompa antes da primeira ação e depois de alguns efeitos. O futuro deve parar e os efeitos completos continuar visíveis.
4. Solicite restauração. Um arquivo preservado pode voltar; um arquivo alterado ou destino em conflito deve ser recusado sem sobrescrita.
5. Repita uma chamada com o mesmo identificador e reinicie durante um efeito. Nenhuma ação externa deve ser repetida automaticamente depois do reinício.
6. Tente caminho fora da pasta, link/junção, URL inválida, argumento extra e ferramenta inexistente. A política deve recusar antes de abrir ou escrever.
7. Abra um aplicativo cadastrado e verifique o processo observado. Um comando disparado sem confirmação de funcionamento deve permanecer falha ou não verificado.

O fluxo atual só pode anunciar os controles realmente implementados. Foco de janela arbitrária, controle visual de qualquer aplicativo, leitura de qualquer página, envio de mensagens e casa conectada exigem adaptadores próprios e não são aprovados por esse ensaio.

## Texto e memória com OpenAI

Em uma conta configurada, faça uma pergunta curta e confira texto chegando por partes. Peça uma ação real da pasta de ensaio, confirme que existe uma autorização local e que a fala final reflete seu resultado. Negue a autorização e confirme que o modelo não anuncia sucesso.

Peça para lembrar uma preferência, autorize, encerre e inicie outra conversa. A preferência deve ser recuperada no mesmo perfil. Outro perfil não deve recebê-la. Edite ou apague a preferência e repita em uma nova conversa. Uma sessão de voz já aberta precisa ser reiniciada para receber o contexto atualizado.

Teste chave inválida, modelo indisponível, limite do provedor e rede desligada. O texto de erro deve ser útil sem expor a chave, corpo bruto de erro ou caminhos privados. Exporte somente diagnósticos sem conteúdo pessoal.

## Microfone, saída e câmera

O roteiro completo está em [Voz e câmera](voice-and-camera.md). A captura local do microfone e uma prévia de webcam podem ser verificadas sem enviar dados ao provedor. Registre separadamente: acesso concedido, sinal capturado, som efetivamente ouvido, tracks liberadas e falha de permissão.

Uma conversa de voz real precisa de chave e sessão conectada; teste pergunta, resposta audível, transcrição, interrupção por fala, botão de interrupção e fim do limite de duração. Um gráfico animado não conta como resposta de áudio. Uma câmera capturando não conta como identificação facial. Reconhecimento real requer pesos e dependências locais, cadastro voluntário e ensaio com pessoas conhecidas/desconhecidas.

Teste duas pessoas, rosto não identificado, luz ruim, óculos, afastamento, retorno e foto/vídeo. Identificação deve ficar neutra quando houver ambiguidade; a câmera nunca deve liberar ação sensível. Apague o cadastro e confirme a exclusão depois de reiniciar. Execute captura e voz juntas para medir se o worker prejudica áudio ou animação.

## Medição comparável

Para cada modelo e dispositivo, grave pelo menos 30 solicitações repetíveis por cenário e mantenha o mesmo protocolo entre versões. Separe ensaio frio de aquecido e registre falhas junto com os tempos; não exclua silenciosamente tentativas lentas.

| Medida | Início | Fim |
| --- | --- | --- |
| Primeiro texto | Envio do pedido | Primeiro delta visível. |
| Primeiro áudio | Fim da fala percebido no cliente | Primeiro som efetivamente reproduzido. |
| Interrupção | Fala da pessoa ou clique | Fim audível da resposta anterior. |
| Ferramenta | Pedido aceito pelo executor | Resultado verificado. Excluir espera humana da medida de execução e reportá-la separadamente. |
| Presença | Primeiro quadro com rosto | Indicação de presença local. |
| Perfil estável | Primeiro quadro elegível | Identificação aceita pela regra temporal. |

Reporte quantidade, sucesso, p50, p95, máximo e método de marcação. O fim da fala, VAD e transporte são etapas distintas: medir somente um evento interno não prova latência percebida. Registre tokens e duração real das sessões para comparar custo. Monitore CPU, memória e frames perdidos com câmera desligada e ligada.

Até que esses ensaios sejam executados, metas como “resposta instantânea”, “melhor que todos os assistentes” e taxa de reconhecimento são objetivos, não resultados demonstrados.

## Registro de uma execução

```text
Data e versão do app:
Superfície: estática / harness local / Electron / executável empacotado
Sistema e hardware:
Modelos e voz:
Credencial: configurada / ausente (nunca incluir valor)
Automáticos: comando, quantidade, aprovados, falhas, skips
Microfone: acesso, captura, liberação
Saída: reprodução e confirmação audível
Câmera: captura e liberação
Identificação real: dependências/pesos, cenários e resultados
Ações: prévia, confirmação, resultado, cancelamento e restauração
Latência: quantidade, p50/p95 e método
Limitações ou falhas em aberto:
```

Antes de publicar uma release, execute instalação limpa, inicialização sem chave, atualização de configuração, empacotamento Windows e encerramento do processo. Não inclua chaves, base privada SQLite, rostos, imagens pessoais, gravações de voz, caches, arquivos de ensaio ou modelos baixados automaticamente no repositório público.
