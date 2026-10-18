# Projeto GleysonSilva-Jarvis

Assistente pessoal para Windows com voz em tempo real, interface holográfica ciano e ações locais que você pode revisar antes de autorizar.

**Estado: MVP 0.1.0 em desenvolvimento.** A versão disponível é o código-fonte no [repositório público Gleysonp-Dev/GleysonSilva-Jarvis](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). Não há instalador assinado nem release de aplicativo validada para distribuição.

O objetivo é combinar uma experiência visual cinematográfica com execução útil e transparente. Superioridade sobre outros assistentes, exclusividade comercial e números de latência dependem de comparação documentada; não são resultados demonstrados por este MVP.

## Uma interface que acompanha a conversa

O núcleo mantém a mesma cor ciano ao ouvir, responder e executar. Sua expansão e seu brilho acompanham o áudio real do microfone e da resposta reproduzida; a execução de ferramentas usa uma cadência própria. O nome central permanece estável. Com a preferência de movimento reduzido, os rótulos continuam explicando o estado.

O painel **Conversa** exibe texto progressivo e transcrições. **Memória** apresenta preferências explícitas por perfil. **Registro** mostra ações e resultados. **Presença** reúne prévia de câmera, cadastro voluntário e reconhecimento facial local opcional. **Ajustes** centraliza chave, modelos, voz, perfil, pasta e aplicativos permitidos.

## O que está implementado

| Recurso | Comportamento atual |
| --- | --- |
| Texto com OpenAI | Responses com streaming, histórico limitado e chamadas de ferramentas. |
| Voz com OpenAI | Realtime por WebRTC, transcrição, resposta audível e interrupção por fala ou botão. Requer chave e acesso aos modelos. |
| Adaptador ElevenLabs | CLI separada de clonagem autorizada e TTS com streaming; ainda não substitui a voz da conversa da interface. |
| Saudação de abertura | “Iniciar Jarvis” prepara cumprimento pelo horário, tempo atual, previsão de hoje e a pergunta final. Usa a voz ElevenLabs configurada e exibe a fonte meteorológica. |
| Amostra da voz Jarvis | Em **Ajustes → Saudação**, “Amostra fixa da voz” reproduz uma frase gravada em MP3 e anima o núcleo pelo áudio, sem API ou microfone. Não contém o boletim meteorológico. |
| Tom metálico | Efeito fixo aplicado no computador à saudação e à amostra, preservando a voz de origem e a pulsação pelo áudio processado. Sem controle de intensidade. |
| Teste local de microfone | Captura sinal e move o núcleo sem chave de API e sem enviar esse áudio ao provedor. |
| Câmera | Prévia local iniciada por clique. Funciona como teste de hardware mesmo sem modelos faciais. |
| Reconhecimento facial | Opcional: YuNet/SFace em um processo Python local, três amostras de cadastro, consistência temporal e escolha explícita de perfil. |
| Memória | Preferências salvas por ação explícita, visíveis e apagáveis por perfil. Recuperação de contexto; não é treino de pesos do modelo. |
| Organização de arquivos | Prévia no primeiro nível da pasta autorizada, agrupamento por extensão, filtro por mês de modificação, confirmação e registro dos movimentos. |
| Restauração | Propõe desfazer movimentos concluídos e recusa arquivos alterados ou destinos em conflito. |
| Ditado | Cria uma nota na pasta autorizada ou solicita abertura de um novo Bloco de Notas no Windows, com confirmação. |
| Aplicativos | Adaptadores para Calculadora, Bloco de Notas, VS Code e navegador; executáveis cadastrados pelo usuário. A abertura ou o foco só são anunciados como confirmados quando o adaptador consegue verificar. |
| Navegador dedicado | Abre endereços HTTP(S) e compartilha somente o trecho selecionado após confirmação. |
| Persistência | SQLite local para memórias, tarefas, procedimentos, chamadas e registro de efeitos. Reiniciar não repete automaticamente uma ação interrompida. |

Controle de qualquer aplicativo pela tela, comandos livres de terminal, automação de contas externas, casa conectada, atualização automática e distribuição comercial pronta ainda não fazem parte desta versão. Os procedimentos persistidos são uma base para evolução; não existe um editor completo de automações na interface atual.

## Começar pelo código-fonte

Requisitos: **Windows, Node.js 24 ou superior e npm**. Conexão é necessária para instalar dependências e usar a OpenAI. Python não é necessário para texto, voz ou prévia da câmera.

Depois de obter o código, abra um terminal na raiz do projeto:

```text
npm install
npm start
```

O primeiro comando instala as dependências; o segundo compila a interface e inicia o Electron. A primeira instalação pode baixar o Electron. Caso um ambiente corporativo bloqueie o download ou a abertura de janelas, use o modo local de teste abaixo e registre essa limitação.

Se um assistente de código estiver preparando a instalação, use o roteiro [AI_INSTALL.md](AI_INSTALL.md).

Para um teste pelo Windows depois da instalação, abra [INICIAR-TESTE.cmd](INICIAR-TESTE.cmd). Ele inicia o servidor em `http://127.0.0.1:47833` e mantém a janela aberta durante o uso. As chaves desse ensaio ficam somente na memória. O aplicativo Electron continua sendo iniciado por `npm start`.

### Primeira conversa

1. Abra **Ajustes** e informe sua chave OpenAI no campo de senha. Não cole a chave na conversa.
2. Confira os modelos. Os padrões do código são `gpt-5.4-mini` para texto, `gpt-realtime` para voz e `marin` como voz sintetizada. O acesso depende da conta e pode exigir outro ID compatível.
3. Salve. Faça uma pergunta por texto para conferir resposta progressiva.
4. Use **Testar microfone** para observar o sinal local. Use **Iniciar conversa por voz** para abrir uma sessão real com o provedor.
5. Encerre a voz e confira que o indicador de microfone do sistema foi liberado. O limite padrão é dez minutos, configurável entre um e trinta.

A sessão de voz pode gerar consumo na conta OpenAI. Texto e voz são modos distintos: digitar não aciona síntese de fala automaticamente.

### Ouvir a amostra da voz Jarvis

Abra **Ajustes → Saudação** e clique em **Amostra fixa da voz** para ouvir a frase gravada com o tom metálico fixo. **Parar amostra** encerra a reprodução. O núcleo mantém o ciano e acompanha o áudio; esse teste não captura o microfone, não usa API e não contém tempo ou previsão.

**Iniciar Jarvis** prepara a saudação dinâmica com cumprimento pelo horário, tempo e previsão para a cidade configurada. **Ouvir saudação** reproduz o áudio já preparado, sem nova consulta ou síntese. Para preparar outro boletim, use **Iniciar Jarvis**. Um arquivo de áudio gravado mantém as informações do momento da geração e não atualiza o clima ao ser reproduzido.

A voz **GleysonSilva-Jarvis** foi criada e a frase foi gerada pelo painel ElevenLabs, com **Eleven Multilingual v2**, em MP3 44,1 kHz/128 kbps. [Arquivo da amostra](assets/voice/jarvis-demo.mp3) e [aviso de distribuição](assets/voice/README.md). O autor ouviu e aprovou a amostra e a narração de abertura com tempo/previsão. A saudação dinâmica preserva o modelo e os parâmetros aprovados; veja [Saudação de abertura](docs/startup-greeting.md).

Essa amostra contém uma frase fixa. Conversas ao vivo continuam usando OpenAI `marin`; a síntese de novas respostas com a voz ElevenLabs ainda precisa ser integrada.

### Primeira ação

Escolha em **Ajustes** uma pasta de ensaio com arquivos descartáveis. Peça: “Mostre uma prévia para organizar os arquivos desta pasta”. Revise a proposta; se desejar, corrija: “Somente os modificados neste mês”. Autorize apenas depois de comparar a lista.

O registro distingue efeito concluído, falha, cancelamento e resultado não verificado. Interromper evita os próximos passos; não apaga efeitos já realizados. A restauração é uma nova ação revisável e pode ser recusada se um arquivo tiver mudado.

### Testar no navegador local

```text
npm run test:local
```

Abra `http://127.0.0.1:47832` no mesmo computador. Esse modo usa a interface funcional, microfone/câmera reais, serviços de texto/voz e uma pasta de ensaio gerada em `local-data/workspace`. O servidor atende somente loopback e exige a bridge de sua própria origem. Não o exponha na rede.

A chave fica apenas na memória do processo local e precisa ser configurada novamente após encerrá-lo. Os adaptadores que abrem programas do Windows não estão disponíveis nesse modo. Esse teste não comprova a proteção de credenciais nem a integração nativa do Electron.

`npm run preview` oferece apenas a prévia da interface, sem a bridge de serviços. Não confunda essa tela com uma sessão OpenAI conectada.

## Reconhecimento facial opcional

O reconhecimento utiliza **Python 3.12 recomendado**, ambiente virtual próprio e os modelos YuNet/SFace guardados na pasta privada de dados do aplicativo. O desktop continua funcionando se eles estiverem ausentes.

Siga [Visão local: instalação e modelos](services/vision/README.md). Dependências, pesos e cadastros não são incluídos no repositório. O serviço recebe quadros locais por pipe privado, não abre conexão de rede e não envia imagens ou vetores à OpenAI. Os quadros originais não são persistidos pelo worker.

No painel **Presença**, ative a câmera, escolha o perfil e cadastre voluntariamente o rosto. O reconhecimento sugere personalização; a pessoa confirma a troca de perfil. Uma webcam RGB pode ser enganada por imagem ou vídeo e não deve ser usada como autenticação. Autorizações de ações continuam sendo explícitas.

## Dados, permissões e voz

- No Electron para Windows, a chave é protegida pelo armazenamento do sistema e fica fora do repositório. A interface não recebe a chave salva de volta.
- A pasta autorizada limita as operações de arquivos. O modelo não recebe um terminal livre nem autoridade para inventar ferramentas.
- Texto, histórico necessário, memórias do perfil e resultados de ferramentas podem ser enviados à OpenAI para responder. Com voz aberta, o áudio do microfone é transmitido ao provedor.
- Teste local de microfone e reconhecimento facial são fluxos locais. Ativar a câmera exige uma ação explícita; fechar o painel libera o dispositivo.
- Memórias e tarefas podem conter conteúdo pessoal. Não publique a base privada, cadastros, imagens, gravações, chaves ou arquivos da pasta de ensaio.
- A voz inicial da conversa é sintetizada pela OpenAI. O clone real ElevenLabs já foi criado e uma amostra gerada foi incluída com autorização do autor. O botão de amostra reproduz somente esse arquivo; respostas dinâmicas ElevenLabs ainda não estão conectadas. O adaptador [ElevenLabs](docs/elevenlabs.md) permite preparar novas gerações; o modelo clonado não é exportável.

Detalhes de fluxo, armazenamento e limites estão em [Arquitetura](docs/architecture.md), [OpenAI](docs/openai.md) e [Voz e câmera](docs/voice-and-camera.md).

## Verificação e evidências

```text
npm test
npm run check
npm run build
```

`npm run verify` reúne os três comandos. A suíte usa transportes e adaptadores substituídos para validar contratos, cancelamento, aprovações, caminhos e registro de efeitos. A visão possui testes opcionais de protocolo com backend de teste.

**Teste automatizado aprovado não equivale a teste com pessoas, hardware ou provedores reais.** Medição de latência, áudio efetivamente ouvido, webcam, reconhecimento com pesos instalados, armazenamento protegido do Windows, instalação limpa e executável empacotado exigem seus próprios registros. Consulte o [plano de testes](docs/test-plan.md) para executar e documentar esses ensaios.

Não existe benchmark publicado que sustente uma promessa de “resposta instantânea” ou “melhor assistente já criado”. O [roadmap](docs/roadmap.md) define as etapas para avaliar e melhorar esses resultados.

## Estrutura

```text
apps/desktop/       processo Electron, bridge limitada, ajustes e adaptadores Windows
apps/desktop/renderer/  React, núcleo Canvas, interface e cliente WebRTC
packages/runtime/   política, ferramentas, SQLite e execução verificável
packages/openai/    Responses, Realtime e tratamento de erros
packages/elevenlabs/ clonagem e síntese separadas, streaming e cancelamento
services/vision/    worker facial Python opcional
scripts/           build, prévia e controle do teste local
tests/             verificações automáticas sem conta paga
docs/              arquitetura, uso, validação e evolução
```

## Contribuir e distribuir

Abra uma descrição reproduzível do problema com sistema, versão, superfície testada e resultado esperado. Remova dados pessoais e credenciais dos anexos. Novas ferramentas precisam de argumentos estritos, escopo de acesso, confirmação quando houver efeito e uma forma de registrar o resultado observado.

O código do projeto usa Apache-2.0; dependências e modelos conservam suas próprias licenças. Confira os arquivos de licença e avisos antes de redistribuir. A identidade visual foi desenvolvida para este protótipo; este é um projeto independente, sem associação com Marvel, Disney, OpenAI ou ElevenLabs. O nome e a apresentação pública devem ser revisados antes de uso comercial.

Responsável: **Gleysonp-Dev**. Código público: [GleysonSilva-Jarvis](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). Uma release executável terá evidências próprias de instalação e funcionamento.
