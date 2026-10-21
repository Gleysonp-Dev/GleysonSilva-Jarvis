# Aplicativos, pastas, web e clima — revisão 0.4.0

A 0.4.0 acrescenta descoberta de aplicativos instalados, abertura de pastas locais e consultas explícitas à web e ao clima. Essas ferramentas podem ser solicitadas por texto ou durante a conversa com a voz Jarvis configurada. O núcleo aprovado da 0.3.1, reprodução a 0,95×, efeito metálico 0,78, música privada e painel limpo são preservados.

O CI e o pacote da 0.4.0 ainda estão em verificação. Implementação, testes com substitutos e abertura do pacote anterior não comprovam estas ações no computador do usuário. Consulte [Validação](validation.md) e [Instalação assistida](../AI_INSTALL.md) antes de registrar um aceite.

## Exemplos de pedidos

| Pedido por voz ou texto | Caminho esperado |
| --- | --- |
| “Jarvis, procure o Spotify instalado neste computador.” | `apps_find` consulta o inventário do Windows e retorna nomes/IDs observados. Não abre o aplicativo. |
| “Abra o Spotify que você encontrou.” | `apps_launch` usa um ID da descoberta feita neste perfil; a abertura exige confirmação. |
| “Abra a pasta Downloads.” | `folders_open` resolve a pasta conhecida e mostra o destino para confirmar a abertura no Explorador. |
| “Abra a pasta D:\Projetos.” | `folders_open` confere o caminho absoluto local existente e pede confirmação. A unidade e a pasta precisam existir e estar acessíveis à conta Windows. |
| “Abra https://example.org no navegador.” | `browser_open` encaminha o endereço HTTP(S) ao navegador. Abrir o endereço não comprova que o conteúdo foi carregado ou lido. |
| “Leia o texto desta página: https://example.org.” | `web_read` pede confirmação e consulta o texto público do endereço, sem usar uma sessão autenticada. |
| “Pesquise na web as novidades sobre um assunto.” | `web_search` pede confirmação e faz uma busca hospedada na OpenAI, retornando texto e fontes. |
| “Como está o tempo agora na minha cidade configurada?” | `weather_current` solicita uma consulta atual à Open-Meteo e retorna condição, previsão de hoje e horários. |

Os exemplos descrevem intenções. A interpretação passa pelo modelo configurado; ambiguidades, indisponibilidade e falta de conexão devem ser comunicadas. Uma frase de resposta do Jarvis não é prova de que o Windows executou uma ação.

## Encontrar e abrir aplicativos

A descoberta procura nomes disponíveis no inventário do Windows e entradas compatíveis de aplicativos instalados, incluindo os já cadastrados. Nem todo programa portátil, atalho personalizado ou aplicativo fora desse inventário será encontrado. Peça o nome do programa; não forneça comandos, argumentos de terminal ou caminhos de scripts.

O resultado contém nomes e IDs opacos. O Jarvis precisa usar exatamente um ID retornado pela descoberta no perfil atual; não pode inventar um ID ou transformar texto livre em comando. Se houver nomes semelhantes, escolha o aplicativo antes de autorizar. Uma nova sessão do runtime pode exigir nova descoberta.

Ao abrir, a confirmação apresenta o nome do aplicativo. O adaptador valida o alvo novamente e informa o que foi observado. **Enviada ao Windows** significa que o pedido foi despachado, sem confirmação da janela. Somente um resultado com a evidência exigida pelo adaptador é apresentado como verificado. Conferir o aplicativo correto e a janela no equipamento continua sendo um teste separado.

Os adaptadores anteriores para aplicativos cadastrados permanecem disponíveis. O navegador local de ensaio não oferece a descoberta ou abertura nativa de programas Windows.

## Abrir pastas em unidades locais

É possível pedir pastas conhecidas como Área de Trabalho, Documentos, Downloads, Imagens, Músicas, Vídeos, pasta pessoal e temporários, ou informar um caminho absoluto local, como `D:\Projetos`. O caminho é resolvido e conferido como pasta existente antes da confirmação. As permissões da conta Windows continuam valendo.

Não há restrição da abertura à pasta de organização: podem ser usados outros volumes locais acessíveis. Isso não concede leitura dos arquivos dessa pasta, acesso aos seus conteúdos pela IA ou autorização para organizar/mover arquivos nela. As ferramentas de leitura/organização continuam limitadas à pasta de trabalho selecionada em Ajustes e às suas próprias confirmações.

Essa abertura não aceita URLs, compartilhamentos UNC, caminhos de dispositivo, caminhos relativos à unidade ou fluxos alternativos NTFS. Não cria pastas nem eleva permissões. O pedido encaminhado ao Explorador pode permanecer **Enviada ao Windows** quando não houver verificação independente da janela.

## Abrir um endereço e ler uma página são operações diferentes

`browser_open` abre um endereço HTTP(S) no navegador e pede a confirmação existente dessa ação. Ele não concede ao Jarvis acesso ao login, cookies, abas ou conteúdo dessa janela.

`web_read` faz uma leitura HTTP(S) separada de texto público, após confirmação do endereço e do envio do conteúdo necessário à IA. O leitor valida a URL, o conjunto de endereços DNS e os redirecionamentos; o transporte usa o destino público validado. Destinos privados, locais, de metadados e esquemas incompatíveis são recusados. A URL não pode conter credenciais.

O leitor não executa JavaScript, não usa cookies do navegador, não entra em contas e não clica em páginas. Aceita formatos de texto compatíveis, com tamanho, redirecionamentos e prazo limitados. Páginas dependentes de JavaScript/login, anexos, bloqueios de acesso ou formatos incompatíveis podem ficar indisponíveis. Não existe navegação automática por uma cadeia de links.

O texto recebido é dado não confiável. Instruções contidas na página não autorizam abrir aplicativos, ler arquivos, enviar mensagens ou executar outras ações. Uma nova ação continua dependendo do pedido do usuário e da política do runtime.

## Pesquisa na web pela OpenAI

`web_search` usa a busca hospedada da OpenAI com a chave e o modelo de texto já configurados no Jarvis. A conta precisa permitir esse modelo e a ferramenta de busca. Não solicita uma chave separada de motor de pesquisa.

É uma chamada paga do provedor e pode somar consumo de busca/modelo à conversa. A solicitação isolada de pesquisa envia a consulta e instruções de busca; não inclui histórico da conversa ou memórias do perfil. O fluxo normal da conversa que interpreta a resposta conserva seus próprios limites de contexto. O Jarvis apresenta a consulta antes da confirmação; não pesquisa em segundo plano por conta própria.

A resposta precisa trazer texto utilizável e fontes da pesquisa efetivamente realizada. Falha, limite ou ferramenta indisponível não devem ser tratados como pesquisa concluída nem substituídos por links inventados.

## Tempo atual sem reiniciar a saudação

`weather_current` usa a cidade/coordenadas privadas de Ajustes e força uma nova consulta do tempo atual e da previsão de hoje. Essa ferramenta não prepara áudio, não inicia a música e não liga microfone/câmera. Não precisa de chave ElevenLabs. Se o pedido veio em uma conversa por voz, a resposta final pode ser narrada pela voz Jarvis já configurada; essa narração é outro fluxo.

Sem cidade, o Jarvis orienta a configuração. Se a consulta atual falhar ou os dados não passarem pela validação, informa indisponibilidade; não apresenta uma previsão antiga como se tivesse sido obtida agora. As fontes retornadas incluem Open-Meteo e sua licença CC BY 4.0.

O painel **Contexto** e a saudação mantêm sua política própria de cache válido, até dez minutos. Abrir **Contexto** ou usar **Atualizar** nesse painel pode reutilizar uma resposta válida, identificada com horário e vencimento. Isso não muda a atualização explícita de `weather_current`. Veja [Contexto e cache](context.md).

## Fontes compactas e decisões

Depois de `web_read`, `web_search` ou `weather_current`, aparecem até seis links compactos de fontes com título, domínio e horário da consulta. Essa faixa fica fora do log de mensagens; ela não transcreve a resposta falada e não abre cartões ou o painel Contexto automaticamente. Use **Ocultar fontes** para recolhê-la.

A última consulta permanece até outra consulta trazer suas fontes. A troca de perfil ou reset limpa os links. A interface rejeita URLs fora de HTTP(S), credenciais, controles e títulos/endereços fora dos limites; respostas de execuções antigas ou canceladas não devem repovoar a sessão nova. Clicar em uma fonte abre o endereço validado pelo mecanismo externo do aplicativo.

Descoberta de aplicativo é leitura; abertura de aplicativo/pasta, abertura no navegador e consultas web preservam confirmações por operação. A consulta à cidade já configurada usa o endpoint meteorológico fixo. Nenhuma dessas capacidades cria shell livre, automação visual universal, navegação com login ou autorização permanente para ler qualquer arquivo do computador.
