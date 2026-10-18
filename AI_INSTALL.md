# Instalação assistida — Projeto GleysonSilva-Jarvis

Roteiro para instalar o [código-fonte público](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis) e entregar um resultado verificável. A revisão **MVP 0.2.1 tem a correção de abertura preparada**, sem release assinada ou executável comprovado em instalação limpa. O EXE 0.2.0 permaneceu sem janela apesar do CI aprovado. O novo teste nativo local foi bloqueado por permissões do ambiente antes do aplicativo; o CI Windows 0.2.1 ainda está pendente.

Tela aberta, conexão, captura, som ouvido, reconhecimento e ação no Windows são evidências distintas. Preserve configurações existentes e informe cada resultado separadamente.

## 1. Inspecionar o ambiente

1. Leia README, package.json e instruções locais aplicáveis.
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

Confirme janela, conversa, Ajustes, Memória, Registro e Presença. O núcleo permanece ciano; sem captura ou sessão real, os indicadores não devem alegar conexão.

### Abertura real do pacote e no CI

O nome previsto é **GleysonSilva-Jarvis-0.2.1-Windows.exe**. Gerar o pacote com `npm run package:win` não basta: execute o aplicativo real e confirme janela criada, interface carregada e encerramento. Para o teste isolado de abertura no CI, use perfil temporário, identificação exclusiva da execução, rede desativada e captura/início no login desligados. Exija evidência de carregamento e saída do processo; somente um PID ou lockfile não comprova sucesso.

A correção 0.2.1 está preparada. No 0.2.0, `await app.whenReady()` no topo ESM impedia concluir a inicialização no Electron 44.9.0. Electron 44.9.0/Node 24.22 e SQLite foram verificados; a causa não era autostart/hardware/SQLite. O ensaio nativo 0.2.1 no ambiente Codex foi bloqueado por ACL do diretório do Electron antes do código do app; não comprova abertura. Não desative a sandbox para contornar esse bloqueio. O novo CI em Windows normal ainda está pendente; registre abertura e recursos separadamente.

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
| Entrada falada e resposta em texto | OpenAI Realtime; padrão `gpt-realtime`. |
| Resposta audível e saudação | Chave ElevenLabs e ID privado de uma voz existente. |
| Sessão | 10 minutos por padrão; permitido de 1 a 30. |
| Perfil | `default` por padrão; memórias separadas por perfil. |

O fluxo de voz 0.2.0 usa OpenAI para compreender/gerar texto e ElevenLabs para narrar. A saída de áudio OpenAI fica desativada. O campo legado `voice: marin`, se presente na configuração, não seleciona a voz audível deste fluxo. Não use uma voz OpenAI ou do navegador como alternativa silenciosa a erro da ElevenLabs.

A voz do autor já foi criada com autorização; **não faça outra clonagem durante a instalação**. Outra instalação precisa de voz disponível na própria conta. O ID e a referência não são públicos. Preserve a síntese aprovada e a reprodução fixa a **0,95× com altura preservada e efeito metálico 0,78**, sem ajustes.

## 4. Executar testes funcionais autorizados

1. **Microfone:** Testar microfone, falar, observar nível, cancelar/parar e conferir liberação. Sem API. Se a permissão ficar pendente, o controle deve permitir cancelar; não gere vários prompts.
2. **Câmera:** iniciar prévia em Presença, conferir imagem e encerrar. Modelos ausentes devem impedir identificação, sem bloquear o teste da câmera.
3. **Texto OpenAI:** fazer pergunta curta e conferir resposta progressiva correta.
4. **Conversa com o clone:** configurar ambos os provedores, perguntar, conferir transcrição e a voz Jarvis realmente ouvida. Testar interrupção por fala/botão, troca de perfil, erro de síntese e liberação. Não aceitar uma voz diferente como sucesso.
5. **Arquivos:** pedir prévia em pasta descartável, corrigir filtro, negar uma proposta e autorizar outra. Conferir registro, efeitos e restauração.
6. **Memória:** salvar preferência de teste, conferir recuperação no mesmo perfil e apagar.
7. **Amostra fixa:** em Ajustes → Saudação, reproduzir/parar a frase gravada sem API ou microfone. Não representa clima atual nem nova conversa.
8. **Recepção:** configurar cidade privadamente e usar Iniciar Jarvis. Conferir relógio, tempo/previsão, atribuição e áudio correspondente. Ouvir saudação repete o áudio preparado sem nova geração.

A geração pode consumir as contas e está sujeita a limites. Não reinicie serviços nem altere quotas para contornar recusas. Um arquivo gravado preserva o boletim do momento da síntese, não uma previsão atualizada.

## 5. Espera e início no login — somente com escolha do usuário

Em Ajustes → Início e espera, as opções `startAtLogin` e `standbyEnabled` começam desligadas. Habilitá-las mantém o microfone em espera local quando aplicável; não habilite como rotina implícita da instalação.

- **Palmas:** duas transientes, separadas entre 150 e 800 ms, com adaptação de ruído e intervalo de proteção. Ensaiar no microfone real; testes sintéticos não comprovam rejeição de toda fala ou música.
- **Palavra “Jarvis”:** Windows System.Speech offline, dependente de reconhecedor de idioma compatível instalado. Não usar Web Speech do navegador como substituto.
- **Durante a recepção:** a espera deve pausar antes da fala/música e retornar depois. Ela também deve ceder o microfone ao teste ou à conversa ativa.
- **Iniciar ao entrar no Windows:** somente no app Windows empacotado, com executável em caminho estável. É entrada na conta, não boot antes do login. O modo de desenvolvimento não comprova esse recurso.
- **Música:** somente arquivo fornecido/selecionado pelo usuário, mantido privado, encerrado ao terminar ou interromper a saudação. O arquivo do ensaio foi importado e a prévia atual com a saudação foi ouvida e aprovada. Não há faixa padrão distribuída; não invente nem gere uma.

Teste pausar/retomar, fechar para bandeja quando configurado, sair de fato e desativar login. Registre reconhecedor ausente ou permissão negada. No navegador, palmas podem sofrer limitações de segundo plano; ele não equivale ao ensaio nativo. Detalhes em [docs/standby.md](docs/standby.md).

## 6. Visão opcional

Texto, voz e prévia não precisam de Python. Para reconhecimento, use Python 3.12 recomendado em ambiente virtual e siga [services/vision/README.md](services/vision/README.md).

Não baixe modelos ou cadastre biometria sem a escolha do usuário. Pesos, rostos e vetores ficam privados. Cadastro voluntário exige três amostras consistentes; o perfil sugerido deve ser confirmado. Webcam RGB não autentica nem autoriza ferramentas.

No ensaio registrado, houve prévia 640×480 e parada; reconhecimento continua indisponível por ausência de OpenCV e pesos. Não reporte isso como identificação aprovada.

## 7. Distinguir baseline de novos recursos

A baseline real e os limites estão em [docs/validation.md](docs/validation.md):

- CI do commit ba0680: 147 testes, compilação e artefato portátil Windows aprovados.
- Falha nativa do EXE 0.2.0 confirmada pelo usuário: processo sem janela, por bloqueio da inicialização ESM. Correção 0.2.1 preparada; abertura local bloqueada por permissão do ambiente antes do app, CI Windows pendente.
- Revisão 0.2.1 local: **218 testes aprovados, zero falhas/skips**, com Python configurado; TypeScript, build e verificação do processo principal aprovados. O teste nativo bloqueado não é resultado de janela aberta.
- Revisão 0.2.0 local: 214 testes aprovados, zero falhas/skips, com Python configurado; TypeScript estrito, build e verificação do processo principal aprovados. O [CI 63cf001](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409) também aprovou 214 testes, TypeScript, build e pacote Windows. O [CI do volume aprovado, e0d8ddaa](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917), também aprovou testes, TypeScript, build e pacote Windows, incluindo o ajuste.
- Ajustes inspecionados no navegador: início no login/palavra nativa desabilitados corretamente; espera exige voz/chave/cidade e opções salvas foram preservadas.
- Texto OpenAI correto, microfone com nível/liberação e câmera 640×480/parada foram observados.
- Um ensaio OpenAI Realtime foi ouvido, porém usou `marin`, diferente da voz desejada. Ele motivou a nova rota OpenAI → texto → ElevenLabs.
- Saudação, velocidade 0,95× e efeito fixo foram aprovados.
- Música privada: MP3 de aproximadamente 13 MB importado; prévia atual com a saudação gravada ouvida e aprovada: 17,8577 s, pico 0,7772, RMS 0,08711 e sem saturação. Ganho 0,35 na introdução/0,22 sob a fala; preset de voz preservado, TypeScript e build aprovados.
- **Ainda pendentes:** abertura corrigida do pacote 0.2.1, nova conversa real com o clone, ativação nativa, retorno da espera, login e música na recepção ao vivo. A aprovação auditiva da prévia não comprova esses fluxos.

Não transforme implementação ou teste com substituto em prova de hardware. Registre a execução atual e seus skips, sem copiar resultados antigos como se fossem novos.

## Entrega esperada

```text
Ambiente e Node:
Versão/commit:
Verificações: aprovadas / falhas / skips
Superfície: Electron / navegador local / prévia / EXE
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
