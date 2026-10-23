# Instalação assistida — Projeto GleysonSilva-Jarvis

## Revisão 0.6.3 — busca recuperável e interrupção por voz correlacionada

A 0.6.3 permite uma **nova busca explicitamente solicitada** depois de um bloqueio transitório na janela YouTube. A recuperação entra na fila e mantém navegação limitada a HTTPS no YouTube; não aceita login/consentimento ou contorna avisos do site. Uma busca nova substitui os resultados observados da anterior, e tocar continua exigindo ID observado no perfil.

Com ferramenta pendente, um evento inicial de fala apenas silencia a narração. O Jarvis espera transcrição não vazia da mesma fala para cancelar as execuções capturadas; resultado antigo não deve gerar continuação enquanto a entrada estiver pendente. **Interromper**, encerrar voz, troca de perfil e X/Sair continuam cancelando imediatamente. Essa correção de código não prova que VAD causou o problema físico relatado. [Fluxo de voz](docs/openai.md) e [YouTube](docs/youtube.md).

**CI, pacote Windows e ensaio real da 0.6.3 ainda pendentes.** Verificação local: **558 testes, 547 aprovados, 11 falhas EPERM anteriores do sandbox, zero skips**; TypeScript/build aprovados. [Detalhes](docs/validation.md). Não há novo hash ou resultado de CI atribuído a esta revisão. Os **534/534 testes** e os arquivos conferidos abaixo pertencem à **0.6.2**. O plugin privado permanece 0.6.0; não reinstale ou altere credenciais como parte desse teste sem necessidade. Preserve voz, cidade, trilha, login configurado e cadastro facial; a recepção continua sem comentário de roupa ou câmera automática.

Para o ensaio da 0.6.3 quando o pacote estiver disponível e conferido: buscar um vídeo, tocar, pedir nova pesquisa a partir da página do vídeo e tocar um resultado da busca nova. Repetir com ruído sem fala transcrita e com uma nova fala durante ferramenta pendente; conferir que somente a execução antiga correlacionada é cancelada. Testar também Interromper/encerrar voz, perfil e X. Não reinicie a sessão do usuário nem publique argumentos de ferramentas, memórias ou credenciais para diagnosticar a falha. [Registro](docs/validation.md).

## Base anterior 0.6.2 — recepção sem câmera automática

A recepção atual é **Windows → espera local → duas palmas → música e saudação com clima → comandos por voz**, conforme as opções salvas. O comentário de roupa foi retirado da interface, do preset e dos endpoints ativos. O aplicativo não pede câmera nem envia imagem à OpenAI ao iniciar a recepção. A preferência antiga `receptionOutfitEnabled: true` é migrada para `false`; preserve voz, chaves, cidade, música, login e demais escolhas. A câmera manual e o reconhecimento local em Presença continuam disponíveis.

A 0.6.2 também altera o tratamento de anúncios, vídeo oculto, observação inicial do player e expiração do YouTube. Anúncios aguardam sua conclusão natural, sem clicar para pular; expirar a tentativa preserva a janela, enquanto cancelamento, troca de perfil e saída continuam interrompendo o fluxo. [CI 20d1cd8 da 0.6.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39873055096) aprovado: **534/534 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa com player em HTTPS local e áudio silenciado. **O novo ensaio físico da recepção, YouTube ao vivo e som ouvido continuam pendentes.** A verificação local teve 534 testes, 523 aprovados e 11 falhas EPERM conhecidas no sandbox, zero skips; TypeScript e build passaram. [Detalhes](docs/validation.md). Os pacotes de versões anteriores são históricos e não contêm esta correção. [Recepção](docs/startup-greeting.md) e [YouTube](docs/youtube.md).

Na 0.6.1, o usuário confirmou a busca real no YouTube e relatou que o vídeo não começou a tocar. A causa dessa falha ainda não foi determinada no computador de destino; não atribua o relato a anúncio, conta ou navegador sem evidência. O [CI 0f293d0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39857691300) aprovou **529/529 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa com player em página HTTPS local e áudio silenciado. Isso não confirmou reprodução ao vivo ou som ouvido. A 0.6.1 permanece registrada com seus hashes a seguir.

O usuário confirmou que duas palmas ativaram a recepção na 0.6.0. Esse resultado não substitui um ensaio após novo login/reinício do Windows. O plugin Jarvis · Ultron permanece 0.6.0 com cinco ferramentas; as três ferramentas YouTube pertencem à conversa nativa.

## Pacote Windows 0.6.2 conferido

Baixe o [Windows 0.6.2 da execução 39873055096](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39873055096/artifacts/12466994007). ZIP e executável foram baixados e conferidos por tamanho e SHA-256; a extração aceitou somente o EXE esperado e seu arquivo de checksum.

| Arquivo conferido | Tamanho em bytes | SHA-256 |
| --- | ---: | --- |
| ZIP do artefato Windows | 104.049.330 | `8ba89d2ffe60b6b1b135f2af37653a84d315676db46b0d8f6cbb46b04a0c1089` |
| GleysonSilva-Jarvis-0.6.2-Windows.exe | 104.038.521 | `ea6587b5ff8531998a64531e4c11cdeda4987e5fae7b9c7fa091572d3cf172b1` |

O [job 120151897176](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39873055096/job/120151897176), commit `20d1cd8d5cfb433c0028980216df6f678ac4792c`, confirmou `ready/window/dom/preload/boot/fullscreen/youtube/packaged` verdadeiros em **22 de outubro de 2026, às 19h41, America/New_York**. O teste de player usou página HTTPS local, mídia PCM e áudio silenciado; não comprova YouTube ao vivo, som ouvido ou a recepção física.

Retenção até **20 de janeiro de 2027, às 18h37, America/New_York**. É artefato temporário do GitHub Actions, que pode exigir login; não é release assinada nem link permanente. O workflow também gerou um artefato do plugin; sua versão permanece **0.6.0** e ele não foi baixado nem reinstalado nesta atualização.

Feche a versão anterior por **X/Sair**, extraia o ZIP e abra **GleysonSilva-Jarvis-0.6.2-Windows.exe**. Confira **MVP / 06.2**; preserve chaves, voz, cidade, trilha e cadastro facial. Uma preferência antiga de roupa é migrada para falso, sem nova clonagem ou captura de câmera na recepção. Teste duas palmas, saudação→voz e, no YouTube, buscar, tocar, pausar e continuar. A busca da 0.6.1 foi confirmada, mas a reprodução falhou por causa ainda indeterminada; o teste novo deve registrar vídeo correto e som ouvido separadamente. [Recepção](docs/startup-greeting.md), [YouTube](docs/youtube.md) e [validação](docs/validation.md).

## Pacote Windows 0.6.1 conferido

**Pacote histórico, sem as alterações 0.6.2.** [Windows 0.6.1 da execução 39857691300](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39857691300/artifacts/12459274688). ZIP e executável foram baixados e conferidos; a extração limitou-se às duas entradas esperadas.

| Arquivo conferido | Tamanho em bytes | SHA-256 |
| --- | ---: | --- |
| ZIP do artefato Windows | 104.049.083 | `7d42b1916442bec925b64e74f50c3af44e87fdbcecd672f617416224170db795` |
| GleysonSilva-Jarvis-0.6.1-Windows.exe | 104.038.318 | `092fff3bd06f929ec35218318cbcb06a15f9c672e34756e3295d19d5ad973a1f` |

Retenção até **20 de janeiro de 2027, às 16h29, America/New_York**. É um download temporário do GitHub Actions e pode exigir login; não é um link permanente de release. A versão do plugin Ultron permanece 0.6.0 quando usar a conexão privada opcional.

Para reproduzir o ensaio histórico da 0.6.1, feche a versão anterior por **X/Sair**, extraia o ZIP e confira **MVP / 06.1**. O usuário já confirmou busca real e relatou falha ao tocar; pausa, retomada e som ouvido não estão aprovados. A 0.6.2 foi conferida e está registrada acima; o novo ensaio exige a 0.6.3 quando estiver disponível e conferida. [Roteiro completo](docs/youtube.md).

## Base 0.6.0 — integração privada com Ultron

Código da base conferida **0.6.0**, indicador **MVP / 06.0**. A ponte MCP é opcional e começa desligada. Expõe somente estado, clima atual configurado, navegador padrão no Google, site HTTP(S) solicitado e narração de texto pela voz Jarvis. Não conecta o microfone ao Dot nem transfere identidade, memória ou sessão do Ultron.

[CI 2adf71d da 0.6.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39852875109) aprovado: **491/491 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa do Jarvis com tela cheia. O plugin privado foi instalado e habilitado pela CLI oficial e conferido por handshake MCP 0.6.0. Depois da ativação feita pelo usuário na interface, as cinco ferramentas ficaram disponíveis nesta conversa no turno seguinte, sem reiniciar o host. O status confirmou conexão real com cidade e voz configuradas; uma abertura de site retornou despacho `unverified`, sem confirmação da janela. Não houve chamada ao Dot pessoal nem teste de voz ou clima ao vivo pela ponte. Os artefatos históricos abaixo não incluem esta integração. Preserve configurações privadas e feche a versão anterior antes de testar o código novo; não apague chaves, voz, cidade ou música. O teste real pelo Ultron é uma etapa própria, ainda não confirmada.

Além do Jarvis, o servidor STDIO exige Node.js 24 no computador Windows e um cliente local compatível. Leia [Integração privada Ultron → Jarvis](docs/ultron.md): revise o pacote, configure um marketplace privado e instale pela interface suportada. Preparar o catálogo não instala o plugin. No Jarvis, habilite **Ajustes → Conexão privada com Ultron → Permitir que Ultron use o Jarvis neste computador** e salve somente quando for testar. Nenhum arquivo privado de descoberta ou credencial deve entrar no pacote.

O Ultron pode precisar criar uma tarefa local no computador conectado. O PC deve estar online com o ChatGPT aberto; instalação em Codex não comprova disponibilidade na conversa principal do Dot. Confirme as cinco ferramentas na tarefa antes de prometer o fluxo. Não use cookies, automação de login ou uma API pessoal não documentada como alternativa.

## Pacotes 0.6.0 conferidos

Baixe o [Windows 0.6.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39852875109/artifacts/12459041061) e, para a conexão privada opcional, o [plugin Jarvis · Ultron 0.6.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39852875109/artifacts/12458926386). Ambos foram baixados e conferidos. O artefato do plugin é um ZIP externo que contém o pacote de instalação interno; os hashes distinguem esses dois arquivos.

| Arquivo conferido | Tamanho em bytes | SHA-256 |
| --- | ---: | --- |
| ZIP do artefato Windows | 104.043.224 | `f49603974e28b7e7f7d9636791a0b034ae666a8ef625a64f1a4872c0525272c0` |
| GleysonSilva-Jarvis-0.6.0-Windows.exe | 104.032.287 | `83f88d0aff0eb522788522502b35e8b0d1f8ca6800a317a87837052848160c06` |
| ZIP externo do artefato do plugin | 9.523 | `c48a5a62760c4c93f8e434cd79e55961ce23b5f9cdf0b1ef91ee598aa73c3653` |
| Jarvis-Ultron-0.6.0.zip, pacote interno | 9.627 | `410dc12dccc1f8a47ae11a805fced2018e33bbf93014c6b1dd536c4010b7ee6a` |

Retenção dos artefatos até **20 de janeiro de 2027, às 15h54, America/New_York**. São downloads temporários do GitHub Actions, que podem exigir login; não são uma release assinada ou um link permanente. A conferência limitou a extração às duas entradas esperadas em cada artefato externo e às seis entradas do ZIP interno do plugin.

Feche o Jarvis anterior por **X/Sair**, extraia o artefato Windows e abra **GleysonSilva-Jarvis-0.6.0-Windows.exe**. Confira **MVP / 06.0** e preserve os ajustes privados. A instalação do plugin já foi verificada na máquina de validação; em outro computador, siga o [guia privado](docs/ultron.md). Para ativar, use o controle em **Ajustes → Conexão privada com Ultron** e salve. Na máquina de validação, o usuário já confirmou a ativação na interface. O MCP real retornou `connected: true`, versão 0.6.0 e disponibilidade das cinco ferramentas; o pedido de abrir um site foi despachado sem comprovação da janela. Voz, clima ao vivo pela ponte e teste feito pelo Dot pessoal continuam pendentes.

## Base 0.5.3 — navegador padrão direto (histórico)

Código dessa revisão histórica **0.5.3**, indicador **MVP / 05.3**. O pedido explícito “abra o navegador” abre o navegador padrão no Google sem segunda autorização. A exceção não se estende a URLs específicas ou outros aplicativos. [CI b856f89 da 0.5.3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39534111302) aprovado: **415/415 testes, zero falhas/skips**, TypeScript, build, pacote e abertura real do Jarvis, incluindo entrada/saída de tela cheia. As versões anteriores abaixo são históricas. Feche a versão anterior por X/Sair antes de abrir o novo executável e preserve a configuração privada.

O aviso de segurança do Windows para Electron é independente. Esta revisão não modifica o Firewall, cria exceções de rede, desliga alertas ou pede acesso de administrador. A autorização de rede, se necessária e desejada no equipamento, é uma decisão local separada e deve identificar o executável correto do Jarvis. A foto sozinha não confirma o processo/caminho ou a regra aplicada. [Diagnóstico](docs/desktop-access.md).

## Pacote Windows 0.5.3 — histórico

[Pacote Windows 0.5.3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39534111302/artifacts/12316996601) baixado e conferido. EXE **104.021.514 bytes**, SHA-256 `484ef104c1647ff47ec84c43fbfa085f204faf5b9e9f3025476616e77c019398`. ZIP **104.031.894 bytes**, SHA-256 `1605ed7ba38cdc939e4d7afee52a9c4a0d8bb97564cff47cc5f69a6088399cfb`. Retenção até 18 de janeiro de 2027, horário de Nova York; artefato temporário do GitHub, sem assinatura de release.

Extraia o ZIP e abra **GleysonSilva-Jarvis-0.5.3-Windows.exe**, após fechar a versão anterior. Confira **MVP / 05.3**. A nova dispensa de confirmação não exige mudar chaves ou ajustes. O usuário confirmou ter conferido o Jarvis no aviso do Windows e clicado em Permitir; este é um relato separado, sem inspeção das regras pelo agente.

## Atualização 0.5.2 — tela cheia (histórico)

Código da revisão histórica: **0.5.2**, indicador **MVP / 05.2**. [CI 4e90ff5 da 0.5.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39531815223) aprovado: **413/413 testes, zero falhas/skips**, TypeScript, build, pacote e entrada/saída de tela cheia pelo botão real no aplicativo Windows. Os pacotes anteriores abaixo são históricos e não incluem o botão novo. Feche o Jarvis anterior por X/Sair antes de executar a nova versão. Os dados privados usam o mesmo diretório; preserve chaves, voz, cidade e música existentes.

O botão de expandir no canto superior direito e **F11** alternam a tela cheia; **Esc** sai. Valide o retorno à janela durante uma conversa, sem repetir a recepção ou interromper o áudio. A opção vale para a janela atual e não altera a inicialização com o Windows. No navegador, depende do suporte à API de tela cheia. [Detalhes](docs/fullscreen.md).

## Pacote Windows 0.5.2 — histórico

[Pacote Windows 0.5.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39531815223/artifacts/12315892272) baixado e conferido. EXE **104.021.454 bytes**, SHA-256 `2c991916429b4ddd462a21fd2d277ce8fdb28f3ccd6294829911fef6c545cf49`. ZIP **104.031.845 bytes**, SHA-256 `efcfa48a2dc208301842a09562732da4886dc2553934d764742e1dfa77d3bd4b`. Retenção até 18 de janeiro de 2027, horário de Nova York; artefato temporário do GitHub, sem assinatura de release.

Extraia o ZIP e abra **GleysonSilva-Jarvis-0.5.2-Windows.exe**, após fechar a versão anterior. Confira **MVP / 05.2**. A verificação nativa confirmou janela, DOM, preload, boot, entrada/saída de tela cheia e pacote reais com perfil temporário, sem acessar credenciais ou dispositivos do autor.

**Base anterior 0.5.1 — histórico:** navegador padrão sem cadastro e comentário de roupa preparado durante a saudação. [CI b8c6c8f da 0.5.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939) aprovado: **402/402 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. Os pacotes anteriores abaixo são históricos. Para atualizar, feche o Jarvis anterior por X/Sair antes de executar a nova versão, evitando que a trava de instância apenas traga a janela antiga. Confira o indicador **MVP / 05.1**. As chaves, voz, cidade, música e opções salvas usam o mesmo diretório privado e não precisam ser cadastradas novamente. Se início no Windows já estiver ativo, o processo principal registra o caminho estável do novo executável ao abrir; não mova esse arquivo depois.

## Pacote Windows 0.5.1 — histórico

[Pacote Windows 0.5.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939/artifacts/12314447101) baixado e conferido. EXE **104.019.548 bytes**, SHA-256 `ec560e6a0f97d30da134622aa5b9bec512b557d9b335752fb3638eae0c18d3c1`. ZIP **104.029.768 bytes**, SHA-256 `7734d02e37adfd51843f21f25e0e443684b6c3b0664332db44713295b97484f1`. Retenção até 18 de janeiro de 2027, horário de Nova York; artefato GitHub temporário, sem assinatura de release.

Extraia o ZIP e execute **GleysonSilva-Jarvis-0.5.1-Windows.exe**, depois de fechar a versão anterior. A correção preserva os ajustes salvos; não é necessário cadastrar navegador, refazer a voz ou importar a música novamente. O [job 118990403989](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939/job/118990403989), commit `b8c6c8fc74ac1133aaa5020e7c77c6177bdd5344`, confirmou ready/window/DOM/preload/boot e packaged verdadeiros, com perfil temporário e rede/captura/login isolados, em **20 de outubro de 2026, às 21h47, America/New_York**.

Valide “Abra o navegador” com a confirmação legível e sem cadastro de EXE, um aplicativo instalado pelo nome e uma URL específica. Bata duas palmas e confirme que o comentário preparado começa após o fim da saudação sem sobreposição. Permissão negada, cancelamento, falha de reprodução e serviço lento precisam manter câmera/voz sem resultados tardios. Não declarar latência zero ou navegador realmente visível com base apenas em despacho do Windows.

**Base anterior 0.5.0 — histórico:** introduziu a recepção por palmas, roupa e conversa contínua. O [CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovou **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. Esse pacote não inclui as correções da 0.5.1; para validar o código atual, use o pacote mais recente acima. Os valores das versões anteriores são apenas históricos.

## Pacote Windows 0.5.0 — histórico

Baixe o [artefato 12313302731](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376/artifacts/12313302731), extraia o ZIP e abra **GleysonSilva-Jarvis-0.5.0-Windows.exe**. Retenção até 18 de janeiro de 2027, horário de Nova York; não é uma release assinada. ZIP e EXE foram baixados e comparados com o digest/checksum do CI.

| Arquivo 0.5.0 | Tamanho | SHA-256 conferido |
| --- | --- | --- |
| ZIP | 104.030.309 bytes | `1f91bdc0ef50f72bf4dec9ae9c6fb98c9db27d28d91f977202dbcd795d1c578c` |
| GleysonSilva-Jarvis-0.5.0-Windows.exe | 104.020.113 bytes | `a6fa2f1560ba240a8fef369903a2b6ba3a12cd2f2e879d93e47ce87c402ef9f9` |

O [job 118982734554](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376/job/118982734554), commit `fced65256707608fbc00366b29553bab608dd9a1`, confirmou ready/window/DOM/preload/boot e packaged verdadeiros, com perfil temporário e rede/captura/login isolados, em **20 de outubro de 2026, às 21h22, America/New_York**. Não substitui palmas, câmera, som e login físicos. A configuração privada/início no Windows não pôde ser alterada por este ambiente; aplique o preset no app.

No pacote atual, **Ajustes → Início e espera → Ativar recepção completa → Salvar configuração** prepara login, espera por duas palmas, música/saudação, voz e continuidade, sem câmera automática. O controle de roupa não existe na 0.6.2. A escuta contínua transmite áudio à OpenAI e pode consumir a API; não equivale a áudio em nuvem durante a espera local. As opções só passam a valer após salvar. Preserve chaves, voz, trilha e cidade existentes; não ative login ou microfone em uma instalação de terceiros sem essa escolha.

Não reinicie o computador como teste sem o usuário pedir. O registro nativo pode ser confirmado no app e no próximo login real; testes simulados não demonstram palmas físicas ou acesso à câmera. Minimizar preserva a espera/conversa; X encerra. [Guia da recepção](docs/startup-greeting.md), [Espera/login](docs/standby.md).

Roteiro para instalar o [código-fonte público, branch main](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/tree/main) e entregar um resultado verificável. A **0.4.0** acrescenta descoberta de aplicativos, abertura de pastas locais, leitura/pesquisa web e consulta atual de clima. O [CI 475f3f4](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110) aprovou **343 testes**, zero falhas/skips, TypeScript, build, pacote e abertura nativa real, em **20 de outubro de 2026, às 20h48, America/New_York**. O núcleo 0.3.1 aprovado e a voz/música são preservados. Os novos comandos no equipamento do usuário ainda exigem ensaio; não há release assinada nem validação completa em instalação limpa. Veja [Aplicativos, pastas, web e clima](docs/desktop-access.md).

Tela aberta, conexão, captura, som ouvido, reconhecimento e ação no Windows são evidências distintas. Preserve configurações existentes e informe cada resultado separadamente.

## 1. Inspecionar o ambiente

1. Leia README, package.json e instruções locais aplicáveis. Confirme branch `main`, versão e commit utilizados. Para validar a ponte privada, use o código 0.6.0 e registre seu commit; os EXEs 0.5.3 e anteriores não incluem esse incremento.
2. Confirme Windows, Node 24 ou superior e npm; SQLite usa o runtime integrado.
3. Não imprima variáveis de ambiente, credenciais ou arquivos privados.
4. Use uma pasta de ensaio descartável para testar ferramentas.
5. Não habilite início automático ou escuta em segundo plano como efeito da instalação.

```text
node --version
npm --version
npm install
npm run verify
```

Com lockfile válido, `npm ci` pode substituir `npm install` para reproduzir as versões. Não regenere o lockfile para esconder divergências. A instalação do Electron pode exigir rede; registre bloqueios em vez de declarar o aplicativo funcional somente pela compilação.

## 2. Abrir uma superfície funcional

### Electron Windows

```text
npm start
```

Confirme janela, conversa, Contexto, Ajustes, Memória, Registro e Presença. Na 0.3.1, o núcleo usa dez curvas com intensidades distintas, deformação assimétrica, focos luminosos e campo azul sobre grade plana ampla. O centro deixa a grade visível, sem texto novo central ou anéis segmentados. A paleta ciano/azul permanece fixa em todos os estados. Compare com a [análise do vídeo fornecido pelo autor](docs/research/referencia-video-nucleo.md), sem afirmar igualdade de pixels. Sem captura ou sessão real, os indicadores não devem alegar conexão. Movimento reduzido deve congelar a geometria; o nível real do áudio continua sendo a origem do pulso no modo normal.

### Pacote Windows 0.4.0 — histórico

Baixe o [artefato 12312007661](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110/artifacts/12312007661), extraia o ZIP e abra **GleysonSilva-Jarvis-0.4.0-Windows.exe**. Requer autenticação GitHub para baixar, mas não Node para executar. ZIP e EXE foram baixados e conferidos com o digest/checksum do CI; o artefato tem retenção até 18 de janeiro de 2027, horário de Nova York. Preserve os dados privados e o caminho do executável usado no início automático; não habilite ou altere esse recurso como efeito da atualização.

| Arquivo 0.4.0 | Tamanho | SHA-256 conferido |
| --- | --- | --- |
| ZIP do artefato | 104.026.982 bytes | `46e0fb0e12d2cbb26902a84e03b25aaf49fc0868bdfd9d5b45fbab8d6bcbd4e4` |
| GleysonSilva-Jarvis-0.4.0-Windows.exe | 104.016.733 bytes | `002b8131eb1a428c5ff44d6f180613dc029d08b8facdf2529c42dfd388e3e391` |

O [job 118971573471](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110/job/118971573471), commit `475f3f4f9e1326baf79bf308199610741670e0b0`, aprovou ready/window/DOM/preload/boot e packaged verdadeiros com perfil temporário e rede/captura/login isolados. Isso não substitui o ensaio das ferramentas por voz, apps instalados ou acesso da conta à busca paga. Use o [roteiro 0.4.0](docs/desktop-access.md).

### Base histórica 0.3.1

O [artefato Windows da execução 39519770787](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787/artifacts/12310612279) contém a **base anterior 0.3.1**, sem as novas ferramentas. Seus valores abaixo são somente históricos.

| Arquivo 0.3.1 | Tamanho | SHA-256 conferido |
| --- | --- | --- |
| ZIP do artefato | 104.010.427 bytes | `8d148043d4b736d2fe143cb1db0c369e21dcf185d97c0db1a70a2fba8e954b9e` |
| GleysonSilva-Jarvis-0.3.1-Windows.exe | 104.001.614 bytes | `aba928ffc4132cabf96e41d4f089e9f1f4c677875de0577b76506ae8607949f2` |

O [CI da 0.3.1, commit bfcc67b9deebff447cfa112cf755662993002328](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787/job/118960468252) executou o aplicativo real e confirmou janela, DOM, preload e boot, com `packaged: true`, em **20 de outubro de 2026, às 20h14, America/New_York**. O ensaio usa perfil temporário, identificação exclusiva, rede desativada e captura/início no login desligados. Registre separadamente o ensaio da 0.3.1 no equipamento de destino. Um PID ou lockfile sozinho não comprova sucesso.

**Histórico 0.3.0:** o [artefato da revisão anterior](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678/artifacts/12307285731) contém **GleysonSilva-Jarvis-0.3.0-Windows.exe**, cujo SHA-256 é `01bd3300aacdffe787945475a1373224321c8d462d328e12f7ef35c452b72421`. Seu [CI b032bd3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678/job/118939722750) aprovou abertura nativa real em 20 de outubro de 2026, às 19h14, America/New_York. Essa revisão não contém o novo núcleo e não deve ser usada para validar a mudança visual da 0.3.1.

No 0.2.0, `await app.whenReady()` no topo ESM impedia concluir a inicialização no Electron 44.9.0. A revisão 0.2.1 corrigiu esse caminho e passou no CI com Electron real. Electron 44.9.0/Node 24.22 e SQLite foram verificados; a causa não era autostart/hardware/SQLite. O ensaio no ambiente Codex ficou bloqueado por ACL antes do app; isso é distinto da abertura aprovada no CI Windows. Nenhuma sandbox foi desativada para esse aceite. Registre abertura e recursos separadamente.

### Navegador local

```text
npm run test:local
```

Abra `http://127.0.0.1:47832`. [INICIAR-TESTE.cmd](INICIAR-TESTE.cmd) oferece o ensaio Windows na porta `47833`. As chaves ficam só na memória do servidor e desaparecem ao encerrá-lo. **Não reinicie um servidor em uso com credenciais configuradas sem coordenar o ensaio.**

O servidor aceita loopback, usa `local-data/workspace` e não deve ser exposto na rede. Não oferece abrir programas Windows, palavra nativa ou início no login e não comprova proteção nativa das chaves. `npm run preview` é somente visual.

## 3. Configurar provedores privadamente

Peça ao usuário que preencha os campos mascarados em Ajustes, sem enviar a chave ao chat, issue, screenshot ou linha de comando. Uma chave já configurada pode ser usada no escopo autorizado; nunca a revele ou copie.

| Uso | Configuração |
| --- | --- |
| Texto digitado | Chave OpenAI; modelo padrão `gpt-5.4-mini`. |
| Entrada falada e geração interna de texto | OpenAI Realtime; padrão `gpt-realtime`. |
| Resposta audível e saudação | Chave ElevenLabs e ID privado de uma voz existente. |
| Sessão | 10 minutos por padrão; permitido de 1 a 30. |
| Perfil | `default` por padrão; memórias separadas por perfil. |

O fluxo de voz usa OpenAI para compreender/gerar texto e ElevenLabs para narrar. A saída de áudio OpenAI fica desativada. O campo legado `voice: marin`, se presente na configuração, não seleciona a voz audível deste fluxo. Não use uma voz OpenAI ou do navegador como alternativa silenciosa a erro da ElevenLabs.

Na apresentação 0.2.2, saudação e conversa falada não acrescentam transcrições ao painel Conversa: a pessoa ouve o áudio e acompanha a pulsação/estado. Mensagens digitadas e suas respostas continuam no painel; a fonte do clima aparece compacta. Não desative reconhecimento de fala nem remova o histórico interno necessário à OpenAI para obter esse resultado visual.

A voz do autor já foi criada com autorização; **não faça outra clonagem durante a instalação**. Outra instalação precisa de voz disponível na própria conta. O ID e a referência não são públicos. Preserve a síntese aprovada e a reprodução fixa a **0,95× com altura preservada e efeito metálico 0,78**, sem ajustes.

A [amostra pública em assets/voice/jarvis-demo.mp3](assets/voice/jarvis-demo.mp3) é uma frase fixa autorizada, incluída com a documentação no GitHub. Ela não contém o modelo da voz, ID ou credenciais para gerar falas novas. A música recebida fica privada, fora do repositório e do pacote; não a copie para a instalação de terceiros ou para a publicação.

## 4. Executar testes funcionais autorizados

1. **Microfone:** Testar microfone, falar, observar nível, cancelar/parar e conferir liberação. Sem API. Se a permissão ficar pendente, o controle deve permitir cancelar; não gere vários prompts.
2. **Câmera:** iniciar prévia em Presença, conferir imagem e encerrar. Modelos ausentes devem impedir identificação, sem bloquear o teste da câmera.
3. **Texto OpenAI:** fazer pergunta curta e conferir resposta progressiva correta.
4. **Conversa com o clone:** configurar ambos os provedores, perguntar, conferir resposta adequada e a voz Jarvis realmente ouvida, sem transcrição no painel. Testar pulsação, interrupção por fala/botão, troca de perfil, erro de síntese e liberação. Conferir separadamente que mensagens digitadas continuam visíveis. Não aceitar uma voz diferente como sucesso.
5. **Arquivos:** pedir prévia em pasta descartável, corrigir filtro, negar uma proposta e autorizar outra. Conferir registro, efeitos e restauração.
6. **Memória:** salvar preferência de teste, conferir recuperação no mesmo perfil e apagar.
7. **Amostra fixa:** em Ajustes → Saudação, reproduzir/parar a frase gravada sem API ou microfone. Não representa clima atual nem nova conversa.
8. **Recepção:** configurar cidade privadamente e usar Iniciar Jarvis. Conferir relógio, tempo/previsão, atribuição e áudio correspondente. Ouvir saudação repete o áudio preparado sem nova geração.
9. **Contexto:** abrir pelo botão lateral e conferir Tempo e Atividade local, com fonte/horários. Sem cidade, conferir orientação para Ajustes; sem rede, indisponibilidade sem valores inventados. Configurada a cidade, o clima deve funcionar também com saudação automática desligada e sem chave ElevenLabs. Atualizar pode reutilizar cache válido por até dez minutos. Fechar durante consulta e trocar de perfil não devem exibir resposta antiga. Conferir ausência de captura, narração e transcrições adicionadas por essa leitura.
10. **Aplicativos instalados — 0.4.0 Windows:** pedir uma descoberta por nome, escolher entre resultados ambíguos, negar uma abertura e autorizar outra. O ID deve vir do inventário observado no mesmo perfil. Conferir aplicativo/janela separadamente: “Enviada ao Windows” não significa janela verificada.
11. **Pastas — 0.4.0 Windows:** pedir Downloads e uma pasta descartável existente em outro volume local, quando disponível. Revisar e confirmar o caminho. Abrir no Explorador não deve ampliar a pasta de trabalho nem permitir leitura/organização desse destino pela IA.
12. **Web — 0.4.0:** pedir leitura de uma URL pública HTTP(S), revisar endereço/envio de dados e confirmar; conferir fonte compacta fora do log. Testar destino local/login/JavaScript indisponível sem inventar conteúdo. Pedir uma pesquisa explícita, revisar a consulta e confirmar o consumo da conta OpenAI. A subconsulta hospedada usa a chave/modelo de texto existentes, sem histórico/memórias; não habilita navegação automática.
13. **Tempo solicitado agora — 0.4.0:** perguntar o tempo atual com cidade configurada e conferir nova consulta, observação e fontes Open-Meteo/CC BY 4.0. A ferramenta não prepara TTS, música ou microfone. Falha não deve reutilizar uma previsão antiga como atual; Contexto/saudação preservam sua própria política de cache.

No fluxo de voz, as fontes devem continuar acessíveis como links compactos, sem transcrever a resposta ou abrir cartões. Verifique troca de perfil/reset, cancelamento e conclusão atrasada. Os ensaios Windows de descoberta/abertura exigem o app nativo; o navegador local não comprova esses adaptadores. Detalhes e exemplos em [docs/desktop-access.md](docs/desktop-access.md).

A atividade é um snapshot de até 100 execuções recentes do perfil, com até oito exibidas; a contagem separa aberturas despachadas sem verificação de janela. Não é agenda nem integração Google. Google Calendar, e-mail, feed próprio de notícias e briefing combinado ainda não estão implementados; pesquisa web pública não equivale a esses conectores. Não solicite acesso a essas contas durante a instalação. eWeLink e Home Assistant também ficam como expansão futura: o autor não os utiliza e esta revisão não adiciona conectores, contas ou dispositivos. Veja [docs/context.md](docs/context.md).

A geração pode consumir as contas e está sujeita a limites. Não reinicie serviços nem altere quotas para contornar recusas. Um arquivo gravado preserva o boletim do momento da síntese, não uma previsão atualizada.

## 5. Espera e início no login — somente com escolha do usuário

Em Ajustes → Início e espera, as opções `startAtLogin` e `standbyEnabled` começam desligadas. Habilitá-las mantém o microfone em espera local quando aplicável; não habilite como rotina implícita da instalação.

- **Palmas:** duas transientes, separadas entre 150 e 800 ms, com adaptação de ruído e intervalo de proteção. Ensaiar no microfone real; testes sintéticos não comprovam rejeição de toda fala ou música.
- **Palavra “Jarvis”:** Windows System.Speech offline, dependente de reconhecedor de idioma compatível instalado. Não usar Web Speech do navegador como substituto.
- **Durante a recepção:** a espera deve pausar antes da fala/música e retornar depois. Ela também deve ceder o microfone ao teste ou à conversa ativa.
- **Iniciar ao entrar no Windows:** somente no app Windows empacotado, com executável em caminho estável. É entrada na conta, não boot antes do login. O modo de desenvolvimento não comprova esse recurso.
- **Música:** somente arquivo fornecido/selecionado pelo usuário, mantido privado, encerrado ao terminar ou interromper a saudação. O arquivo do ensaio foi importado e a prévia atual com a saudação foi ouvida e aprovada. Não há faixa padrão distribuída; não invente nem gere uma.

Teste pausar/retomar, minimizar para continuar em espera, fechar pelo X para encerrar áudio/captura/aplicativo e desativar login. X e Sair não devem manter a voz tocando nem permitir nova ativação em segundo plano. Registre reconhecedor ausente ou permissão negada. No navegador, palmas podem sofrer limitações de segundo plano; ele não equivale ao ensaio nativo. Detalhes em [docs/standby.md](docs/standby.md).

Os filtros 0.2.3 são mais conservadores, mas continuam heurísticos. Escores do reconhecedor Windows são relativos; não são probabilidade de intenção. O relato de recepção repetida não identifica qual detector disparou. Teste cada gatilho separadamente, fala/TV/impactos e retorno após a própria narração, sem declarar ausência de falsos positivos a partir dos testes sintéticos.

## 6. Visão opcional

Texto, voz e prévia não precisam de Python. Para reconhecimento, use Python 3.12 recomendado em ambiente virtual e siga [services/vision/README.md](services/vision/README.md).

Não baixe modelos ou cadastre biometria sem a escolha do usuário. Pesos, rostos e vetores ficam privados. Cadastro voluntário exige três amostras consistentes; o perfil sugerido deve ser confirmado. Webcam RGB não autentica nem autoriza ferramentas.

No ensaio registrado, houve prévia 640×480 e parada; reconhecimento continua indisponível por ausência de OpenCV e pesos. Não reporte isso como identificação aprovada.

## 7. Distinguir baseline de novos recursos

A 0.4.0 tem [CI 475f3f4 da 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110) aprovado com **343/343 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. A base 0.3.1 tem CI, pacote e abertura nativa real aprovados, e seu núcleo recebeu aceite visual do autor. A bateria completa de dispositivos e as novas ferramentas da 0.4.0 precisam de ensaios próprios. O usuário havia aprovado o roteiro funcional curto da 0.3.0 e reprovado seu núcleo, motivando a revisão visual seguinte. Esse relato não descreve uma bateria completa de dispositivos e cenários. Registre os resultados atuais sem substituir pendências por resultados históricos. A baseline real e os limites estão em [docs/validation.md](docs/validation.md):

- Revisão histórica 0.3.1: **264/264 testes aprovados, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real aprovados no [CI bfcc67b9](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787), em 20 de outubro de 2026, às 20h14, America/New_York. ZIP e EXE baixados e hashes conferidos; núcleo visual aprovado pelo autor. Não comprova as ferramentas da 0.4.0.

- Revisão anterior 0.3.0: **264 testes aprovados, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real aprovados no [CI b032bd3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678). Aceite do roteiro funcional curto informado pelo usuário; núcleo visual reprovado. Não usar esse CI ou o EXE 0.3.0 como prova da 0.3.1.

- CI do commit ba0680: 147 testes, compilação e artefato portátil Windows aprovados.
- Falha nativa do EXE 0.2.0 confirmada pelo usuário: processo sem janela, por bloqueio da inicialização ESM. Correção 0.2.1 aprovada em abertura real no CI e abertura visual no computador do usuário confirmada por captura de tela. O bloqueio local por ACL foi um ensaio separado.
- Revisão 0.2.1: **218 testes aprovados, zero falhas/skips**, TypeScript, build, pacote Windows e teste de abertura nativa aprovados no CI 8a074e7. O ZIP do artefato 12149680971 foi baixado e seu SHA-256 conferido; detalhes em [Validação](docs/validation.md).
- Revisão 0.2.2: **221 testes aprovados, zero falhas/skips**, TypeScript, build, pacote e abertura nativa aprovados no [CI d72c4887](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39164458465). Ensaio visual com serviços substituídos confirmou ausência de transcrições de voz no painel e preservação do texto digitado; não comprova áudio ou captura reais.
- Revisão 0.2.3: **229 testes aprovados, zero falhas/skips**, TypeScript, build, pacote e abertura nativa aprovados no [CI 5733b37](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39166025134). X/Sair/before-quit compartilham encerramento; áudio e janela param antes da espera pelos serviços. Fechamento durante áudio e filtros corrigidos ainda exigem ensaio físico.
- Revisão 0.2.0 local: 214 testes aprovados, zero falhas/skips, com Python configurado; TypeScript estrito, build e verificação do processo principal aprovados. O [CI 63cf001](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409) também aprovou 214 testes, TypeScript, build e pacote Windows. O [CI do volume aprovado, e0d8ddaa](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917), também aprovou testes, TypeScript, build e pacote Windows, incluindo o ajuste.
- Ajustes inspecionados no navegador: início no login/palavra nativa desabilitados corretamente; espera exige voz/chave/cidade e opções salvas foram preservadas.
- Texto OpenAI correto, microfone com nível/liberação e câmera 640×480/parada foram observados.
- Um ensaio OpenAI Realtime foi ouvido, porém usou `marin`, diferente da voz desejada. Ele motivou a nova rota OpenAI → texto → ElevenLabs.
- Saudação, velocidade 0,95× e efeito fixo foram aprovados.
- Música privada: MP3 de aproximadamente 13 MB importado; prévia atual com a saudação gravada ouvida e aprovada: 17,8577 s, pico 0,7772, RMS 0,08711 e sem saturação. Ganho 0,35 na introdução/0,22 sob a fala; preset de voz preservado, TypeScript e build aprovados.
- **Ainda pendentes no aplicativo nativo do usuário:** nova conversa real com o clone, captura/liberação de microfone, ativação por palmas/palavra, retorno da espera, login, proteção das chaves por DPAPI e música na recepção ao vivo. A abertura visual 0.2.1, a aprovação auditiva da prévia e o CI 0.2.2 não comprovam esses fluxos.

Não transforme implementação ou teste com substituto em prova de hardware. Registre a execução atual e seus skips, sem copiar resultados antigos como se fossem novos.

## Entrega esperada

```text
Ambiente e Node:
Versão/commit:
Verificações: aprovadas / falhas / skips
Superfície: Electron / navegador local / prévia / EXE
Núcleo orbital 0.3.1: dez curvas, assimetria, focos, grade plana ampla, paleta ciano/azul fixa, áudio real e movimento reduzido
Ferramentas 0.4.0: descoberta/abertura de aplicativos, pasta local, web/pesquisa com fontes e clima atual / não ensaiado
Contexto: fontes, horário/cache, perfil, indisponibilidade e cancelamento
Microfone: captura, cancelamento e liberação
Câmera: resolução, imagem e liberação
OpenAI texto: resposta real / não ensaiado
Conversa com clone: voz ouvida, interrupção, erro sem fallback / não ensaiado
Espera: palmas, palavra, reconhecedor e pausa/retorno / não ensaiado
Login Windows: pacote, entrada real e desativação / não ensaiado
Música privada: fornecida, fim/cancelamento / não fornecida ou não ensaiado
Reconhecimento: pesos e cadastro real / indisponível ou não ensaiado
Arquivos/memória: efeitos e resultado observado
Limitações e comando para abrir novamente:
```

Não publique releases, áudios privados, dados, modelos ou credenciais como parte automática da instalação. A autorização existente de clonagem e distribuição da amostra selecionada não torna pública a gravação de referência. Veja [Plano de testes](docs/test-plan.md), [ElevenLabs](docs/elevenlabs.md) e o aviso em assets/voice.
