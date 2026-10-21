# Recepção e saudação — revisão 0.5.0

A recepção pode seguir esta sequência: **duas palmas → música e saudação com clima → comentário sobre a roupa → conversa por voz**. As duas últimas etapas são opções explícitas de Ajustes. Iniciar ao entrar no Windows e a espera também são escolhas da instalação; o pacote público não ativa captura ou login por conta própria. Veja [Espera e login](standby.md).

[CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovado: **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O ensaio físico integrado desta sequência ainda deve ser registrado em [Validação](validation.md). Os **343 testes e a abertura nativa aprovados na 0.4.0** são evidência da versão anterior, não da nova recepção.

## Saudação e música

Ao receber o gatilho elegível, o controlador pausa a espera local e prepara a fala com o horário do computador, tempo atual e previsão de hoje na cidade configurada. A frase final permanece **“Em que posso ajudá-lo agora, senhor?”**. A saudação é construída pelo serviço meteorológico e não por um LLM.

O serviço usa “Bom dia” das 06h às 11h59, “Boa tarde” das 12h às 17h59 e “Boa noite” nos demais horários. Hora e fuso vêm do computador. Nome da cidade e coordenadas ficam na configuração privada; a localização pessoal do autor não acompanha o repositório.

A música selecionada privadamente acompanha a recepção inicial e termina com o fim ou a interrupção da saudação. Não continua no comentário de roupa nem na conversa. A espera por palmas/palavra fica suspensa durante som próprio e conversa para evitar que o assistente se reative. **Nenhuma trilha padrão é distribuída.** O arquivo privado aprovado pelo autor fica fora do GitHub e do pacote.

O áudio usa a voz ElevenLabs configurada naquela instalação. A abertura não toca a apresentação fixa “Olá, …”; **Ajustes → Saudação → Amostra fixa da voz** é um teste separado, sem clima ou captura. O preset aprovado é Eleven Multilingual v2, estabilidade 0,5, similaridade 0,75, estilo 0, speaker boost ligado e velocidade de síntese 1. Os campos seguem a [configuração oficial de voz](https://elevenlabs.io/docs/api-reference/voices/settings/update).

A reprodução mantém **0,95× com a altura preservada** e efeito metálico local fixo **0,78**, sem ajuste de intensidade. Saudação, comentário sobre roupa e respostas faladas usam essa mesma rota. Não há substituição silenciosa pela voz OpenAI ou do navegador.

## Comentário sobre a roupa

Com a opção de comentário de roupa habilitada e uma chave OpenAI configurada, o aplicativo pede a câmera após terminar a saudação. Captura somente **um JPEG, até 640×480 e 512 KiB**; encerra as tracks de vídeo antes de encaminhar o quadro para a OpenAI. Não mantém um vídeo ao vivo nem salva a imagem no histórico ou em arquivo.

A opção informa explicitamente que **uma imagem da câmera será enviada à OpenAI**. O serviço usa Responses com o modelo de texto configurado, `detail: 'low'` e `store:false`, sem histórico, memórias ou ferramentas. O pedido limita a resposta a um comentário breve e cordial sobre a roupa visível: cor, peça ou combinação. Não identifica a pessoa nem infere saúde, idade, origem, religião ou outros atributos pessoais.

Se o enquadramento não mostrar roupa suficiente, a resposta deve reconhecer essa limitação. Permissão negada, câmera ocupada, chave ausente, modelo incompatível ou falha de rede não geram um elogio inventado. A etapa informa indisponibilidade e pode seguir para voz, se essa opção estiver habilitada e disponível. O comentário usa a voz aprovada e não acrescenta transcrição ao dashboard. Esse recurso não depende de YuNet/SFace e não cadastra um rosto. Veja [Voz e câmera](voice-and-camera.md).

O backend aceita somente uma observação pendente por perfil, com intervalo mínimo de um minuto e até seis tentativas por hora. Esses limites não provocam nova captura automática quando atingidos. Cada comentário é uma solicitação de imagem/modelo e uma nova síntese de voz, sujeitas à disponibilidade e ao consumo dos provedores.

## Entrada na conversa

Com **conversa após a recepção** habilitada, o aplicativo inicia a captura de microfone e a sessão OpenAI Realtime somente depois das etapas anteriores. A resposta audível continua sendo ElevenLabs. A opção de **conversa contínua** permite renovar uma sessão encerrada por prazo normal enquanto essa intenção continuar ativa; não repete a música, a saudação ou a câmera a cada renovação.

Falhas de autenticação ou rede não criam um ciclo de novas tentativas. **Interromper**, troca de perfil, reset ou saída cancelam a recepção e a intenção de renovação, param áudio/captura e invalidam resultados antigos. Encerrar a sessão contínua exige uma nova escolha para voltar a ouvir. Detalhes de conexão e custos estão em [OpenAI](openai.md).

## Tempo e previsão

O serviço consulta somente `https://api.open-meteo.com/v1/forecast`, sem chave meteorológica. Solicita temperatura atual, condição WMO, mínima/máxima do dia e probabilidade máxima de precipitação. As condições são dados de modelo meteorológico, não medição de sensor do computador. Consulte a [documentação Open-Meteo](https://open-meteo.com/en/docs).

Timestamps Unix são comparados com a data no fuso do computador. O serviço rejeita condição desconhecida, temperatura/unidade inválida, previsão de outro dia, dado atual com mais de três horas ou mais de quinze minutos no futuro. Só fala a probabilidade quando houver porcentagem válida. Se a consulta falhar, diz **“Não consegui consultar o tempo agora.”** e preserva a pergunta final; não inventa valores.

A consulta tem prazo de oito segundos. O resumo validado pode ficar em cache de memória por até dez minutos, vinculado às coordenadas, ao fuso e à data. Não há histórico completo de tempo salvo em arquivos. A ferramenta `weather_current`, usada em perguntas de clima durante a conversa, força nova consulta e não usa uma previsão antiga quando essa atualização falha. Ela não reinicia a recepção. Veja [Acesso desktop e web](desktop-access.md).

Com dados válidos, a interface exibe fonte e licença compactas: **Dados Open-Meteo (CC BY 4.0), resumidos em português**. A [licença](https://open-meteo.com/en/licence) e os [termos da API gratuita](https://open-meteo.com/en/terms) são questões distintas: o endpoint gratuito desta implementação se destina a uso não comercial, sujeito aos limites do serviço.

## Controle e contrato

`StartupGreetingService`, em `packages/greeting/index.mjs`, recebe configuração e chave ElevenLabs do backend. `prepare({hour,timezone},{signal})` devolve texto, clima validado, MP3 limitado em base64 ou `null`, razão de indisponibilidade e atribuição. Não devolve chave, ID de voz ou coordenadas. `readWeather()` permite consultar o clima sem síntese ou captura. A síntese tem prazo de vinte segundos, texto até 600 caracteres e áudio em memória até 2 MiB.

Sem chave, a preparação informa `reason: requires_key`, com `audioBase64: null`; não apresenta a amostra gravada como boletim atual. Voz ausente ou falha de síntese também ficam explícitas. Se o navegador exigir gesto, **Ouvir saudação** reproduz o áudio preparado, sem nova consulta/síntese.

O controlador limita repetição, aceita somente uma recepção por vez e propaga cancelamento ao backend. Um resultado antigo não pode tocar áudio, abrir câmera ou reconectar voz após interrupção, troca de perfil ou saída. Saudação e comentário são apresentados por som, pulsação e estados, sem transcrição no painel Conversa; mensagens digitadas continuam visíveis.

Os testes com transporte e dispositivos substituídos verificam esses contratos; não comprovam palmas físicas, som ouvido, roupa corretamente descrita ou entrada real no Windows. Execute o [plano de testes](test-plan.md) no pacote de destino e registre cada evidência separadamente.
