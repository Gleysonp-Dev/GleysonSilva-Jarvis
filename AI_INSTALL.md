# Instalação assistida — Projeto GleysonSilva-Jarvis

Roteiro para um assistente de código instalar o projeto e entregar um estado de funcionamento verificável. O código-fonte está no [repositório público Gleysonp-Dev/GleysonSilva-Jarvis](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis).

## Objetivo da instalação

Preparar o código-fonte, executar as verificações, iniciar uma superfície utilizável e explicar o que foi confirmado. Uma tela aberta, uma chamada paga, a reprodução audível e o reconhecimento de alguém são evidências diferentes. Informe os resultados separadamente.

O estado inicial é MVP 0.1.0, sem instalador assinado ou executável distribuído validado. O modo padrão de desenvolvimento é Electron para Windows. O modo de teste no navegador local ajuda a verificar hardware e serviços quando a abertura de um aplicativo nativo não for possível.

## 1. Inspeção do ambiente

1. Leia `README.md`, `package.json` e instruções locais aplicáveis. Confirme que o terminal está na raiz do projeto.
2. Verifique sistema operacional, versão de Node e npm. O runtime requer Node 24 ou superior, inclusive por usar SQLite integrado.
3. Confirme que a pasta do projeto não contém credenciais, base privada ou arquivos pessoais incluídos por engano. Não imprima valores de variáveis de ambiente.
4. Use uma pasta de ensaio gerada para os primeiros testes de arquivos. Não selecione automaticamente pastas pessoais amplas.

Comandos de diagnóstico:

```text
node --version
npm --version
```

Se Node estiver ausente ou fora da versão suportada, explique a dependência e siga as regras de instalação do ambiente. Não desative políticas do sistema ou proteções do aplicativo para contornar uma falha.

## 2. Dependências e validação

Na raiz:

```text
npm install
npm run verify
```

Se o checkout publicado contiver `package-lock.json` válido e o objetivo for reproduzir exatamente suas versões, `npm ci` pode substituir `npm install`. Não apague nem regenere o lockfile apenas para esconder uma divergência.

A instalação do Electron pode precisar de rede. Diante de bloqueio de rede, falta de dependência ou recusa de execução, registre a causa real e use os mecanismos de aprovação disponíveis. Não anuncie que o aplicativo funciona com base apenas em uma compilação bem-sucedida.

Guarde um resumo dos comandos e seus códigos de saída. Registre falhas e testes opcionais ignorados. Nunca coloque a chave no relatório.

## 3. Iniciar e verificar a interface

### Aplicativo Windows

```text
npm start
```

Confirme que a janela do projeto abriu, que os textos estão legíveis e que **Ajustes**, **Memória**, **Registro** e **Presença** funcionam. O núcleo deve manter o ciano original em todos os estados. Sem sessão, não declare microfone, câmera ou OpenAI como conectados.

### Alternativa no navegador local

```text
npm run test:local
```

Abra `http://127.0.0.1:47832` no mesmo computador. O servidor deve continuar limitado a loopback. Esse modo usa `local-data/workspace` para arquivos de ensaio e chave temporária em memória. Não permite abrir aplicativos do Windows. Encerrar o processo remove a chave temporária.

Não substitua esse comando por uma hospedagem pública. Não coloque a bridge, a chave ou os dados privados em um site externo.

`npm run preview` é uma prévia visual sem bridge de serviços. Se essa for a única superfície que abriu, descreva-a como prévia.

## 4. Configuração privada da OpenAI

Peça que o usuário preencha o campo mascarado de **Ajustes**, sem enviar a chave à conversa, issue, arquivo público, screenshot ou comando que a imprima. Uma chave já configurada pode ser usada dentro do escopo autorizado; não a revele nem a copie para o renderer.

Os padrões do código são:

| Campo | Padrão |
| --- | --- |
| Texto | `gpt-5.4-mini` |
| Voz em tempo real | `gpt-realtime` |
| Voz sintetizada | `marin` |
| Perfil | `default` |
| Limite de voz | 10 minutos, permitido de 1 a 30 |

A conta precisa aceitar os modelos e dispor dos recursos necessários. Preserve escolhas explícitas do usuário. Se um ID não estiver disponível, explique o erro antes de escolher uma alternativa compatível. Consulte [docs/openai.md](docs/openai.md) para protocolo e dados enviados ao provedor.

## 5. Teste funcional guiado

Teste somente o que estiver autorizado na sessão. Microfone e câmera devem ser iniciados pelos controles explícitos da interface; instalação não implica manter dispositivos capturando em segundo plano.

1. **Microfone local:** ative o teste, fale e observe o envelope real. Encerre e confira a liberação do dispositivo. Esse teste não envia áudio à OpenAI.
2. **Câmera:** abra Presença e ative a prévia. Sem modelos, a imagem pode aparecer e a identificação deve informar a dependência ausente. Feche e confirme liberação.
3. **Texto real:** com chave configurada, faça uma pergunta curta e confira resposta progressiva. Se ocorrer erro, registre-o sem corpo bruto ou segredo.
4. **Voz real:** abra uma sessão, confira transcrição e som efetivamente ouvido. Interrompa pela fala e pelo botão. Encerre. Uma conexão WebRTC aberta não comprova que o usuário ouviu a saída.
5. **Arquivos de ensaio:** peça a prévia, corrija o filtro, negue uma proposta e autorize outra após revisão. Confira o sistema de arquivos e o registro. Teste restauração somente nos arquivos descartáveis.
6. **Memória:** grave uma preferência de teste, confirme o registro, inicie nova conversa e depois apague-a. Não use informação pessoal desnecessária.
7. **Amostra Jarvis:** clique em **Ouvir amostra Jarvis**, confirme som audível, pulsação pelo áudio e funcionamento de **Parar amostra**. O arquivo é local, dispensa API e não abre microfone. Registre a escuta separadamente da geração/download já confirmados.

Se uma etapa depender de participação humana, entregue o controle pronto para uso e diga exatamente o que falta confirmar. Não simule sucesso para completar a lista.

## 6. Visão opcional

Texto, voz e prévia de câmera não dependem de Python. Para reconhecimento, recomende Python 3.12 em ambiente virtual e siga [services/vision/README.md](services/vision/README.md).

Pesos YuNet/SFace ficam na pasta privada `models` dos dados do aplicativo, fora do checkout. Instale dependências opcionais somente quando o usuário quiser habilitar reconhecimento. Use os binários reais dos modelos, confira origem/licença e registre hash antes de redistribuir. Não publique rostos, embeddings ou amostras pessoais.

O cadastro é voluntário, exige três amostras consistentes e a escolha explícita de perfil. Reconhecimento não concede autoridade para ações. A webcam RGB não oferece prova de vida.

## 7. Voz personalizada e distribuição

A voz padrão da conversa OpenAI funciona sem clonagem. A voz **GleysonSilva-Jarvis** já foi criada pelo painel ElevenLabs, e uma frase foi gerada com Eleven Multilingual v2 e baixada em MP3. O arquivo `assets/voice/jarvis-demo.mp3` pode ser reproduzido pelo controle **Ouvir amostra Jarvis**, sem API ou microfone. Essa é uma frase fixa: a conversa dinâmica continua usando OpenAI `marin`. Não anuncie respostas ElevenLabs ao vivo como conectadas.

O adaptador [ElevenLabs](docs/elevenlabs.md) fornece `scripts/voice.mjs` com `clone` e `speak`, além de streaming no código. O autor já confirmou autorização para clonar a referência e distribuir os áudios gerados; não peça a mesma autorização novamente. A gravação de referência continua privada, assim como a credencial e o ID de voz em `local-data/voice.json`. Para uma nova clonagem pela CLI, o sinalizador explícito `--consent` e a chave ElevenLabs em variável do processo continuam necessários.

O resultado real desta preparação veio do painel no navegador, não de uma chamada executada pela CLI. O autor já ouviu e aprovou a amostra e a narração de abertura; preserve Eleven Multilingual v2 e seus parâmetros explícitos no serviço de saudação. Estar autenticado no navegador não disponibiliza automaticamente a chave à CLI ou ao aplicativo. Não refaça a clonagem durante a instalação e não afirme que o provedor exporta pesos. O áudio de futuras gerações pela CLI começa em `local-data/audio`, privado e ignorado pelo Git; a demonstração pública selecionada possui aviso próprio em `assets/voice/README.md`. A abertura automática ainda exige ensaio da configuração privada conforme [docs/startup-greeting.md](docs/startup-greeting.md).

Não execute publicação, criação de release, upload de gravações ou distribuição do aplicativo como parte automática desta instalação, salvo autorização do usuário. Não inclua credenciais, `local-data`, base SQLite, modelos, cadastros ou arquivos de ensaio no Git.

## Entrega esperada

Conclua com um relatório breve:

```text
Ambiente e versão de Node:
Dependências e verificações: aprovadas / falhas / skips
Superfície iniciada: Electron / teste local / prévia
Microfone: captura e liberação confirmadas / não ensaiado
Câmera: prévia e liberação confirmadas / não ensaiado
OpenAI texto: sessão real / não ensaiado
OpenAI voz: conexão, áudio ouvido e interrupção / não ensaiado
Reconhecimento facial: modelos e cadastro reais / não ensaiado
Ações locais: pasta de ensaio e resultado observado / não ensaiado
Pendências e comando para abrir novamente:
```

Resultados de latência e qualidade só entram no relatório quando medidos. O plano completo está em [docs/test-plan.md](docs/test-plan.md).
