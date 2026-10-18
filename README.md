# Projeto GleysonSilva-Jarvis

Assistente pessoal para Windows com interface holográfica ciano, conversa por voz e ações locais que você pode revisar antes de autorizar.

**Estado: MVP 0.2.2 em preparação, sem novo CI confirmado.** Código no [repositório público Gleysonp-Dev/GleysonSilva-Jarvis](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). A base 0.2.1 passou pelo teste nativo no CI Windows e sua abertura no computador do usuário foi confirmada por captura de tela. Isso confirma a interface aberta, sem comprovar conversa com o clone, microfone nativo, login ou proteção das chaves. Não há release assinada ou validação completa em instalação limpa.

O núcleo mantém a mesma cor ao ouvir, responder e executar. Brilho e expansão acompanham o sinal de áudio; ferramentas usam uma cadência própria. O painel mantém controles e estados funcionais, sem slogans. Memórias são preferências explícitas por perfil, revisáveis e apagáveis; não são retreinamento do modelo.

Na revisão 0.2.2, saudação e conversa por voz usam áudio e pulsação, sem acrescentar falas ou transcrições ao painel **Conversa**. As mensagens digitadas e suas respostas continuam visíveis. A fonte do clima permanece compacta, sem reproduzir o boletim em texto. Essa mudança é de apresentação: a compreensão de voz e o histórico necessário aos provedores continuam funcionando internamente.

## O que está implementado

| Recurso | Comportamento do código atual |
| --- | --- |
| Texto com OpenAI | Responses com streaming, histórico limitado e ferramentas. |
| Conversa com a voz Jarvis | Microfone via OpenAI Realtime; respostas em texto são sintetizadas pela ElevenLabs com a voz configurada. A saída de áudio OpenAI é desativada. O novo fluxo completo ainda precisa de teste real. |
| Saudação e clima | **Iniciar Jarvis** prepara cumprimento pelo relógio do PC, tempo atual, previsão de hoje e “Em que posso ajudá-lo agora, senhor?”. Narração por áudio/pulsação e atribuição Open-Meteo compacta, sem transcrição no painel. |
| Voz aprovada | Clone ElevenLabs já criado com autorização. Reprodução local a 0,95×, altura preservada e tom metálico fixo no preset 0,78; sem controles de ajuste. |
| Espera local opcional | Duas palmas pelo Web Audio; palavra “Jarvis” pelo reconhecedor offline System.Speech no Windows, quando disponível. Pausa a espera durante fala e uso ativo do microfone. |
| Início no Windows | Opção desativada por padrão; disponível no aplicativo Windows empacotado. Inicia ao entrar na conta do Windows, em espera quando configurado; não opera antes do login. |
| Música da recepção | Arquivo do usuário importado privadamente; prévia atual com a saudação ouvida e aprovada. Nenhuma faixa padrão é distribuída. |
| Amostra fixa | **Ajustes → Saudação → Amostra fixa da voz** toca um MP3 de apresentação, sem API ou microfone. Não contém clima atual. |
| Teste de microfone | Mede sinal local e pulsa o núcleo sem enviar áudio ao provedor. |
| Câmera | Prévia por clique, independente dos modelos faciais. |
| Reconhecimento facial | Opcional: Python, YuNet/SFace, cadastro voluntário e consistência temporal. Sugere um perfil; não autoriza ações. |
| Arquivos | Prévia no primeiro nível da pasta autorizada, agrupamento por extensão, filtro por mês, confirmação, movimentos registrados e restauração condicionada. |
| Aplicativos | Adaptadores limitados para Calculadora, Bloco de Notas, VS Code e navegador, com executáveis cadastrados. |
| Persistência | SQLite para memórias, tarefas, procedimentos e efeitos; reiniciar não repete automaticamente ações interrompidas. |

Controle visual universal de aplicativos, terminal irrestrito, casa conectada, editor completo de automações e atualização automática continuam fora do escopo atual. Não há benchmark que demonstre exclusividade, superioridade geral ou resposta instantânea.

## Começar pelo código-fonte

Requisitos: **Windows, Node.js 24 ou superior e npm**. Python não é necessário para texto, voz ou prévia da câmera. Instalação de dependências e serviços externos exigem conexão.

Na raiz do projeto:

```text
npm install
npm start
```

O segundo comando compila a interface e abre o Electron. O roteiro [AI_INSTALL.md](AI_INSTALL.md) orienta uma instalação assistida e o registro dos testes.

O pacote validado é **GleysonSilva-Jarvis-0.2.1-Windows.exe**. O CI confirmou janela e carregamento da interface; o usuário também confirmou a abertura visual por captura de tela. O pacote 0.2.2 ainda está em preparação. A presença de um processo ou o sucesso do empacotamento, isoladamente, não bastam.

### Configuração e primeira conversa

1. Abra **Ajustes** e informe a chave OpenAI no campo mascarado. Não cole credenciais na conversa.
2. Os padrões são `gpt-5.4-mini` para texto e `gpt-realtime` para entrada de voz e geração de texto. O acesso depende da conta.
3. Salve e faça uma pergunta por texto. Digitar não liga o microfone nem aciona fala automaticamente.
4. Em **Saudação e tempo**, configure privadamente a chave ElevenLabs e o identificador da voz já criada. A conversa falada exige os dois provedores; falta de voz ou falha de síntese informa indisponibilidade, sem trocar para uma voz OpenAI ou do navegador.
5. Use **Testar microfone** para conferir captura local. Depois inicie a conversa por voz e confirme resposta adequada realmente ouvida, pulsação e interrupção, sem transcrição no painel. Encerre e confira a liberação do dispositivo.

O limite padrão da sessão é dez minutos, ajustável entre um e trinta. A conversa pode consumir OpenAI e ElevenLabs. A troca do caminho de voz foi implementada após um ensaio ouvir a voz OpenAI `marin`; esse resultado anterior não comprova a nova conversa com o clone.

### Recepção, espera e música

Configure a cidade privadamente e use **Iniciar Jarvis** para preparar uma saudação com clima. **Ouvir saudação** repete o áudio preparado sem nova consulta ou síntese. Um arquivo gravado conserva o boletim do momento da geração; reproduzi-lo não atualiza o tempo.

Em **Ajustes → Início e espera**, escolha conscientemente manter o microfone em espera, usar duas palmas e/ou a palavra “Jarvis”. O detector de palmas processa o sinal no computador. A palavra exige um reconhecedor de idioma compatível instalado no Windows e não usa Web Speech do navegador. A espera não abre uma conversa com a OpenAI; o gatilho inicia a recepção com clima.

**Iniciar ao entrar no Windows** é uma opção separada para a versão empacotada. Instalar o código não ativa captura em segundo plano nem registra início automático. O navegador de teste não altera o login do Windows e não oferece a palavra de ativação nativa.

A música depende de um arquivo fornecido pelo usuário e mantido privado. A prévia atual com a saudação foi ouvida e aprovada, com ganho de 0,35 na introdução e 0,22 sob a fala. O ensaio na recepção ao vivo ainda está pendente. Não existe trilha padrão nesta entrega. Consulte [Espera e início no Windows](docs/standby.md) para requisitos, pausa, encerramento e limitações.

### Primeira ação

Escolha uma pasta de ensaio com arquivos descartáveis. Peça uma prévia de organização, revise a proposta e, se necessário, corrija “somente os modificados neste mês” antes de autorizar.

O registro distingue resultado verificado, falha, cancelamento e resultado não verificado. Interromper evita os próximos passos; não desfaz efeitos concluídos. A restauração é uma nova proposta e recusa conflitos ou arquivos alterados.

## Testar no navegador local

```text
npm run test:local
```

Abra `http://127.0.0.1:47832` no mesmo computador. O modo funcional usa microfone/câmera reais, serviços configurados e `local-data/workspace` como pasta de ensaio. O servidor aceita somente loopback e a bridge de sua origem. Não o exponha na rede.

Depois de instalar as dependências, [INICIAR-TESTE.cmd](INICIAR-TESTE.cmd) oferece o mesmo ensaio na porta `47833`, mantendo a janela do servidor aberta. **As chaves ficam apenas na memória do processo** e são perdidas ao encerrá-lo. Não reinicie o servidor durante uma configuração ou ensaio em curso.

Esse modo não oferece adaptadores de aplicativos Windows, início no login, palavra de ativação nativa nem comprova armazenamento protegido do Electron. Navegadores também podem limitar captura e temporizadores em segundo plano. `npm run preview` é somente uma prévia visual sem bridge.

## Reconhecimento facial opcional

Siga [Visão local: instalação e modelos](services/vision/README.md), com Python 3.12 recomendado e ambiente virtual próprio. Dependências, modelos, cadastros e imagens ficam fora do repositório. O worker usa pipe privado, não abre rede e não envia quadros ou vetores aos provedores.

No equipamento ensaiado, a câmera produziu prévia real **640×480** e foi encerrada. **Identificação permanece indisponível:** OpenCV e os pesos faciais ainda não estão instalados. Prévia de webcam não comprova reconhecimento.

O cadastro é voluntário. A pessoa confirma o perfil sugerido; reconhecimento nunca substitui autorização de ferramentas. Webcam RGB pode ser enganada por imagem/vídeo e não é autenticação segura.

## Dados e permissões

- No Electron Windows, as chaves OpenAI e ElevenLabs são protegidas pelo mecanismo do sistema no processo principal, fora do checkout. A interface não recebe os valores salvos de volta. Essa proteção ainda exige ensaio nativo.
- Texto, histórico necessário, preferências do perfil e resultados de ferramentas podem ser enviados à OpenAI. Uma conversa de voz aberta transmite áudio do microfone à OpenAI; o texto a narrar vai à ElevenLabs.
- Teste local de microfone, palmas, palavra nativa e visão são processamento local. A espera mantém acesso ao microfone enquanto ativada; pode ser pausada.
- A consulta de clima envia as coordenadas configuradas à Open-Meteo. A fonte e a licença acompanham o resultado.
- Não publique chaves, banco, cidade privada, identificador da voz, rostos, gravação de referência, música privada ou arquivos de ensaio. Um MP3 autorizado não inclui um modelo exportável da voz.
- A pasta selecionada limita o executor. O modelo não recebe terminal livre nem pode inventar autoridade para ferramentas.

Detalhes em [Arquitetura](docs/architecture.md), [OpenAI](docs/openai.md), [ElevenLabs](docs/elevenlabs.md) e [Voz e câmera](docs/voice-and-camera.md).

## Verificação e evidências

```text
npm run verify
```

O [CI da base 0.2.0, commit 63cf001](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409), aprovou **214 testes**, TypeScript, build e empacotamento Windows. O [CI do volume aprovado, e0d8ddaa](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917), também concluiu testes, TypeScript, build e empacotamento com sucesso; seu artefato inclui o ajuste. A baseline ba0680 havia aprovado 147 testes.

**Falha nativa confirmada no 0.2.0:** processo ativo sem janela. O `await app.whenReady()` no topo do módulo ESM bloqueava a inicialização no Electron 44.9.0. A revisão 0.2.1 move a espera para uma função de inicialização. A falha não veio de autostart/hardware; Electron 44.9.0/Node 24.22 carregou SQLite corretamente. O novo teste nativo local parou antes do código do aplicativo por restrição de permissões do ambiente, sem comprovar abertura corrigida.

A revisão 0.2.0 passou localmente por **214 testes**, zero falhas/skips, com Python configurado, TypeScript estrito e build aprovados. A interface de ajustes foi inspecionada no navegador: opções nativas indisponíveis ficaram desabilitadas e a configuração da espera foi preservada. Testes com substitutos e inspeção de controles não comprovam ativação física.

A revisão **0.2.1 passou por 218 testes**, zero falhas/skips, TypeScript, build, empacotamento e **teste nativo real no [CI Windows 8a074e7](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39162376494)**. O teste confirmou aplicação pronta, janela, DOM, preload, boot e pacote em cerca de dois segundos. O bloqueio por permissões do ambiente local foi um resultado separado e não ocorreu nesse CI.

No ensaio real foram confirmados texto OpenAI correto, microfone com nível e liberação, prévia de câmera 640×480 e parada, saudação aprovada e áudio OpenAI Realtime ouvido. Este último usou `marin`, voz diferente da desejada, motivando a troca para ElevenLabs.

**Ainda não confirmados no aplicativo nativo do usuário:** nova conversa completa com o clone, captura/liberação do microfone, ativação por palmas/palavra, retorno da espera, início no login e persistência protegida das chaves. A captura de tela da janela e o teste de abertura do CI não exercitaram esses recursos. A apresentação sem transcrições da revisão 0.2.2 ainda exige verificação e novo CI. Não há latência comparável medida nem acurácia facial demonstrada. Veja [Validação](docs/validation.md), [Plano de testes](docs/test-plan.md) e [Roadmap](docs/roadmap.md).

## Estrutura

```text
apps/desktop/           Electron, bridge limitada, ajustes e adaptadores Windows
apps/desktop/renderer/  React, HUD Canvas, WebRTC, áudio e detector local de palmas
apps/desktop/platform/  reconhecimento offline Windows
packages/runtime/      política, SQLite, ferramentas e execução
packages/openai/       Responses, Realtime e erros
packages/speech/       síntese da conversa, correlação e cancelamento
packages/greeting/     cumprimento, clima e narração de abertura
packages/elevenlabs/    transporte, clonagem autorizada e TTS
services/vision/       worker facial Python opcional
tests/                 testes automáticos com rede/hardware substituídos
docs/                  arquitetura, uso, validação e evolução
```

## Contribuir e distribuir

Relate sistema, versão, superfície, reprodução e resultado esperado, sem dados pessoais ou segredos. Ferramentas novas precisam de argumentos estritos, acesso limitado, aprovação de efeitos e evidência de resultado.

O código usa Apache-2.0; dependências e modelos conservam suas licenças. Projeto independente, sem associação com Marvel, Disney, OpenAI ou ElevenLabs. O [aviso da amostra pública](assets/voice/README.md) registra origem sintética e distribuição autorizada. Revise identidade e licenças antes de uso comercial. Responsável: **Gleysonp-Dev**.
