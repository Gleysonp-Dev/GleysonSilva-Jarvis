# Controle de aplicativos na Fire TV — 0.7.0 em validação

Esta integração acrescenta à conversa nativa do Jarvis a abertura de aplicativos de uma Fire TV configurada pelo proprietário. É a primeira etapa de controle de TV do Jarvis Home; não representa a entrega de automação residencial completa. Identificação de pessoas pela voz ficou para uma etapa posterior.

## Configuração privada

1. Deixe o computador do Jarvis e a Fire TV na mesma rede local, com comunicação entre os dois dispositivos permitida pelo roteador.
2. Na TV, habilite **Depuração ADB** em Configurações → Minha Fire TV/Dispositivo e software → Opções do desenvolvedor. O menu varia entre modelos. Para abrir aplicativos já instalados, este fluxo não instala APKs nem precisa habilitar aplicativos de fontes desconhecidas.
3. No Jarvis, encerre a conversa por voz e abra **Ajustes → TV · Fire TV**.
4. Marque **Controlar Fire TV pela rede**, informe o **IP da TV** e salve a configuração. Use o IP privado mostrado pela própria TV; não informe nomes de rede, senhas ou códigos no chat.
5. Reabra Ajustes e clique em **Parear TV**. Aprove o computador na tela da televisão. A aprovação é feita pela pessoa diante da TV; o Jarvis não aceita essa solicitação por conta própria.
6. Use **Testar conexão**. Depois, inicie a conversa por voz e peça **“Jarvis, abra a Netflix na TV”**.

O endereço e a habilitação ficam neste computador; o registro de pareamento é vinculado ao IP e ao perfil ativo. Trocar o IP ou o perfil exige pareamento correspondente; copiar apenas o endereço não transfere uma aprovação. Esta etapa mantém um destino e um registro de chave por instalação. Uma reserva de IP no roteador evita que o endereço mude entre reinícios. O Jarvis não procura televisores na rede nem abre acesso pela internet.

## O que acontece com um comando

O modelo interpreta o pedido e escolhe uma ferramenta com argumentos fechados. O adaptador consulta os pacotes instalados na TV configurada e só solicita a abertura quando encontra o aplicativo permitido nesse resultado. Nomes de aplicativo, pacotes e comandos recebidos da TV são dados; não autorizam executar instruções livres.

As ferramentas nativas são `tv_open_app({app})` e `tv_control({action})`. O IP é obtido somente da configuração salva, nunca dos argumentos produzidos pelo modelo. O plugin privado Ultron permanece com suas cinco ferramentas anteriores; esta etapa não acrescenta controle de TV ao MCP.

O catálogo inicial inclui **Netflix, Prime Video, YouTube, Disney+, Max e Spotify**, desde que um pacote conhecido esteja instalado na TV. Não significa suporte automático a todo aplicativo instalado. Outros aplicativos precisam de uma integração com identificador validado. Há também comandos fixos de controle remoto: Início, Voltar, setas, OK, aumentar/diminuir volume, mudo, tocar e pausar; o efeito pode variar conforme o modelo e a tela ativa.

Exemplos: **“Jarvis, abra a Netflix”**, **“Abra o Prime Video na TV”** e **“Volte ao início da TV”**. O pedido de Netflix é encaminhado à TV configurada; um destino explícito Windows/navegador deve ser respeitado. Para YouTube, especifique “na TV” para distinguir do YouTube controlado no computador.

Abrir um aplicativo não confirma reprodução de um filme, autenticação em conta nem som ouvido. O resultado distingue comando enviado de estado observado: uma resposta de ADB ou do lançador, sozinha, não comprova qual tela apareceu. Falha, falta de pareamento ou aplicativo ausente devem ser comunicados sem anunciar uma abertura confirmada.

O aplicativo deve estar instalado e utilizável pelo proprietário. Telas de escolha de perfil, login, assinatura, compras e consentimento permanecem para intervenção humana. Esta etapa não oferece instalação, remoção, compras, comandos de terminal livres ou automação geral dentro de aplicativos de terceiros.

Na TV testada, a tela de escolha de perfil da Netflix não forneceu nomes de perfis na hierarquia acessível; a tentativa de captura também não produziu uma imagem válida. Não foi possível identificar e verificar uma opção pelo nome. O Jarvis não contorna essa limitação nem escolhe por coordenadas presumidas. O usuário pode observar a TV e solicitar comandos individuais, como **“Jarvis, seta para a direita na TV”** e **“Confirme na TV”**, para usar as ações `right` e `ok`; essa navegação guiada pelo usuário não é seleção automática de perfil.

## Conexão e proteção

O cliente ADB é implementado em Node e se comunica diretamente com o dispositivo. O produto não inicia um servidor ADB no computador nem depende do SDK Android, de Python ou de chaves globais em `.android`. O pareamento usa uma chave própria do Jarvis, protegida pelo armazenamento seguro do sistema operacional; ela não é retornada à interface ou ao modelo e não faz parte do repositório ou do pacote público.

A chave pública só pode ser apresentada à TV no fluxo explícito de pareamento. Um comando de voz normal não inicia esse fluxo nem contorna a aprovação da TV. Cancelar, trocar o perfil ou fechar o Jarvis interrompe operações ainda pendentes; um comando já entregue à TV pode ter ocorrido e não é desfeito pelo cancelamento.

ADB oferece poderes mais amplos que os disponibilizados pelas ferramentas do Jarvis. Esta integração limita os comandos do produto, mas não transforma a depuração ADB da TV em um serviço de controle remoto restrito. Use uma rede residencial confiável, sem redirecionamento da porta ADB para a internet. Desabilitar o controle no Jarvis impede os próximos pedidos do aplicativo; para encerrar a autorização no dispositivo, desligue a depuração ou revogue as autorizações nas configurações da TV.

O transporte inicial é ADB TCP com autenticação RSA. Não deve ser apresentado como uma conexão TLS: autorização do computador e criptografia do tráfego são propriedades diferentes. Equipamentos que exijam outro método de pareamento/transporte precisam de suporte específico.

## Evidência e limites da etapa

Um ensaio anterior enviou uma única vez o comando Início para uma Hisense com Fire TV. O usuário confirmou que a TV saiu da Netflix e voltou à tela principal. Esse teste usou uma ferramenta de diagnóstico separada; não valida o cliente Node, a abertura de Netflix pelo produto nem a conversa por voz.

Na primeira tentativa com o cliente Node do produto, a autenticação ocorreu, mas a segunda consulta de identificação falhou por um fechamento tardio duplicado de uma stream anterior. O ajuste mantém verificação de checksum/IDs e aceita somente duplicatas vazias de pares já encerrados, dentro de limites. **No reteste do cliente Node isolado**, as três identificações foram concluídas, o cliente observou o pacote instalado e enviou uma única solicitação para Netflix; **o usuário confirmou que a Netflix abriu**. O retorno do cliente permaneceu `unverified`; a confirmação veio da observação humana. Isso não valida o pacote novo, a voz, o pareamento/armazenamento seguro pela interface ou outros aplicativos/controles.

A suíte local desta etapa teve **641 testes, 630 aprovados e as 11 falhas EPERM anteriores do sandbox, zero skips**; TypeScript/build passaram. O transporte corrigido passou seus 48 testes. CI, pacote, interface e ensaio de voz 0.7.0 permanecem pendentes. Seleção automática de perfil Netflix não foi implementada ou aprovada; não se escolhe perfil por posição presumida ou setas adivinhadas. Os **576 testes da versão 0.6.5** pertencem à base anterior e não comprovam esta integração. [Validação](validation.md#revisão-070--fire-tv-em-validação).

Para validar o produto, configure a TV na interface, pareie e teste a conexão; saia manualmente da Netflix, peça sua abertura por voz e confirme a mudança na própria tela. Registre também ausência do aplicativo, IP inacessível, aprovação recusada, cancelamento e troca de perfil. Não publique IP, identificadores da rede, chaves ou inventário particular da residência.

## Referências de interoperabilidade

- [Amazon: conexão com Fire TV por ADB](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html).
- [AOSP: protocolo ADB e autenticação](https://android.googlesource.com/platform/packages/modules/adb/+/1a0fb8846d4e6b671c8aa7f137a8c21d7b248716/protocol.txt).
- [AOSP: autenticação RSA do cliente](https://android.googlesource.com/platform/system/core.git/+/8b47d316d253d05f92cf853d5b44cc28666848fe/adb/client/auth.cpp).
- [AOSP: formato da chave pública Android](https://android.googlesource.com/platform/system/core/+/refs/heads/main/libcrypto_utils/android_pubkey.cpp).
- [Android: funcionamento do ADB e autorização do computador](https://developer.android.com/tools/adb).
- [Android: ferramenta Monkey e restrição por pacote](https://developer.android.com/studio/test/other-testing-tools/monkey).

As referências descrevem interoperabilidade. O código do cliente do Jarvis é próprio; não há redistribuição do SDK Android, do código de aplicativos de TV ou de credenciais do proprietário. Marcas, serviços e conteúdo permanecem sujeitos aos respectivos titulares.
