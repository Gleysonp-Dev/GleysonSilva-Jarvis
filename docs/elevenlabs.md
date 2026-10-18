# Projeto GleysonSilva-Jarvis: voz ElevenLabs

O clone **GleysonSilva-Jarvis** foi criado na conta ElevenLabs e uma frase foi gerada e baixada pelo painel do navegador. A interface oferece **Ouvir amostra Jarvis** para reproduzir esse MP3 local, com pulsação pelo áudio e sem API ou microfone. O adaptador também fornece uma CLI e uma API de código com streaming para novas gerações. **A fala dinâmica da conversa continua usando OpenAI Realtime com a voz `marin`; ainda não está conectada ao adaptador ElevenLabs.**

O responsável pelo projeto confirmou autorização para clonar a referência escolhida e distribuir publicamente os áudios gerados. A gravação original, a credencial e o ID de voz continuam privados. A criação foi confirmada pelo painel com a mensagem de voz pronta; a etapa adicional de microfone era apresentada como opcional e não foi utilizada. Estar conectado ao painel no navegador não configura uma chave para a CLI.

## Estado atual

| Item | Estado |
| --- | --- |
| Adaptador REST sem SDK adicional | Implementado com `fetch` nativo no Node 24. |
| Consentimento explícito na CLI | Obrigatório antes de ler ou enviar a amostra. |
| Clonagem remota confirmada | Voz GleysonSilva-Jarvis criada pelo painel; conta observada no plano Creator. |
| MP3 real de demonstração | Frase gerada pelo painel e baixada; arquivo de 137.309 bytes incluído no projeto com aviso de distribuição. |
| Streaming pela API do adaptador | Implementado e verificado com respostas simuladas; não foi a origem do áudio de demonstração. |
| Reprodução da amostra no Jarvis | Botão explícito usa o arquivo local, sem captura e sem API. A qualidade da amostra foi aprovada pelo autor. |
| Respostas dinâmicas ElevenLabs no Jarvis | Ainda não conectadas. |
| Exportar modelo clonado para o GitHub | Não é fornecido pelo serviço. |
| Credencial e amostra no repositório | Não incluídas. |

A referência utilizada tem aproximadamente **20,2 segundos**, menor que a recomendação de 1–2 minutos de fala limpa e consistente. O autor ouviu e aprovou a amostra gerada e a narração de abertura com tempo/previsão; essa aprovação de uso não é um benchmark de fidelidade. O guia oficial também informa que clones permanecem na conta e não podem ser exportados como um modelo independente. [Instant Voice Cloning](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning).

## Amostra real incluída

O arquivo [jarvis-demo.mp3](../assets/voice/jarvis-demo.mp3) contém uma frase fixa de 131 caracteres. Foi gerado pelo painel com **Eleven Multilingual v2**, velocidade 1, estabilidade 0,5, similaridade 0,75, estilo 0 e speaker boost ligado; formato MP3 44,1 kHz/128 kbps. O arquivo baixado possui 137.309 bytes. A configuração do ID continua em `local-data/voice.json`, ignorado pelo Git, sem ser incorporada ao bundle.

O botão **Ouvir amostra Jarvis** inicia a reprodução apenas após clique. **Parar amostra** encerra o áudio, e o núcleo ciano acompanha o sinal reproduzido por um analisador local. A amostra foi ouvida e aprovada pelo autor. O [aviso de distribuição](../assets/voice/README.md) informa sua origem sintética e a autorização concedida.

A [saudação de abertura](startup-greeting.md) usa o modelo aprovado Eleven Multilingual v2 com estabilidade 0,5, similaridade 0,75, estilo 0, speaker boost ligado e velocidade 1 enviados explicitamente. O padrão Flash da CLI permanece disponível para outros ensaios, sem alterar automaticamente essa narração aprovada.

Esta geração real ocorreu na interface web ElevenLabs. A suíte de testes do adaptador continua usando transporte simulado; não há afirmação de que a CLI executou uma requisição real. Não é necessário clonar novamente para ouvir a demonstração.

## Credencial privada

A CLI lê somente `ELEVENLABS_API_KEY` do ambiente do processo. Não recebe a chave como argumento, não cria `.env`, não a grava em `voice.json` e não usa cookies da sessão do navegador. Não cole a chave na conversa, no código ou em um comando que a imprima.

No PowerShell, um modo de definir a variável sem escrever a chave em texto na linha de comando é:

```powershell
$jarvisElevenSecret = Read-Host 'Chave ElevenLabs' -AsSecureString
$env:ELEVENLABS_API_KEY = [System.Net.NetworkCredential]::new('', $jarvisElevenSecret).Password
```

A chave ainda estará disponível ao processo e seus filhos enquanto definida. Depois de encerrar os comandos, remova-a da sessão:

```powershell
Remove-Item Env:ELEVENLABS_API_KEY
Remove-Variable jarvisElevenSecret
```

O plano e as permissões da conta precisam permitir clonagem e síntese. Erros de acesso são mostrados sem corpo bruto do provedor nem credencial. Não há repetição automática de clonagem, pois uma requisição aceita pode ter criado uma voz mesmo se a conexão caiu antes da resposta.

## Criar uma voz com a amostra escolhida

Na raiz do projeto:

```text
node scripts/voice.mjs clone --sample "C:/CAMINHO_PRIVADO/reference.wav" --name "Jarvis" --consent
```

Substitua somente o caminho pelo WAV exato que deseja enviar. O comando não procura outros arquivos, não copia a gravação para o projeto e envia o arquivo selecionado à ElevenLabs apenas quando executado. `--consent` confirma os direitos e o consentimento para a clonagem. A autorização já concedida pelo autor permite prosseguir no seu fluxo; a opção explícita evita reutilizações acidentais da ferramenta.

O envio usa `POST /v1/voices/add`, campo multipart `files`, nome e remoção de ruído desligada. Não fixe manualmente o cabeçalho multipart: o `fetch` cria o boundary. A [referência da API](https://elevenlabs.io/docs/api-reference/voices/ivc/create) apresenta o resultado `voice_id` e `requires_verification`; o [SDK oficial](https://github.com/elevenlabs/elevenlabs-js/blob/main/src/api/resources/voices/resources/ivc/client/Client.ts) confirma o nome de campo `files`.

Quando o serviço confirma o resultado, a CLI grava `local-data/voice.json`, uma pasta ignorada pelo Git. A configuração contém o ID de voz, nome, estado de verificação, modelo preferido, data da confirmação local e metadados/hash da amostra. Não contém a chave, o caminho privado nem os bytes da gravação. O console informa o arquivo de configuração e se existe verificação pendente; não imprime a chave ou o ID.

Se já existir configuração, o comando recusa criar outra voz sem `--replace`. Essa opção cria uma nova voz e substitui apenas a configuração local; não apaga a voz antiga da conta. Se ocorrer interrupção, timeout ou falha depois de enviar a amostra, consulte **My Voices** antes de repetir. Verificação pendente precisa ser resolvida no provedor; o código não a contorna.

## Gerar áudio privado

Com uma voz já salva e pronta:

```text
node scripts/voice.mjs speak --text "Olá. Estou pronto para ajudar."
```

Também é possível escolher explicitamente um ID de voz existente na sua conta:

```text
node scripts/voice.mjs speak --voice-id ID_DA_SUA_VOZ --text "Olá. Estou pronto para ajudar." --model eleven_flash_v2_5
```

O padrão é `eleven_flash_v2_5`, português e MP3 `mp3_44100_128`. `eleven_multilingual_v2` pode ser escolhido para comparação; nesse modelo, o adaptador omite `language_code`, que não é suportado. O endpoint [Stream speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream) transmite áudio binário progressivamente. A implementação não utiliza o parâmetro de otimização de latência depreciado e não promete latência medida.

O arquivo completo vai para `local-data/audio/jarvis-<data>-<id>.mp3`, inicialmente privado e ignorado pelo Git. A CLI não toca o áudio automaticamente e não publica o resultado. Uma falha ou cancelamento descarta o arquivo parcial. O áudio gerado é sintético; preserve essa indicação ao compartilhá-lo.

Um MP3 pode ser revisado e copiado explicitamente para uma pasta pública de demonstração quando desejado. Um MP3 pronto só reproduz aquele texto. Respostas novas com a mesma voz exigem novas gerações pela API ou a integração futura de um backend local de voz; o modelo ElevenLabs não é incorporado ao repositório.

## API para a futura integração

`ElevenLabsService` está em `packages/elevenlabs/index.mjs`:

```javascript
import { ElevenLabsService } from './packages/elevenlabs/index.mjs';

const voice = new ElevenLabsService({ getKey: () => process.env.ELEVENLABS_API_KEY });
const controller = new AbortController();

for await (const bytes of voice.streamSpeech({
  voiceId: 'ID_DA_SUA_VOZ',
  text: 'Texto já autorizado para envio ao provedor.',
  outputFormat: 'pcm_24000',
}, { signal: controller.signal })) {
  // Encaminhar bytes a um controlador de reprodução confiável com backpressure.
}
```

Esse exemplo é uma API de transporte, sem áudio reproduzido ou captura de microfone. `streamSpeech` fornece chunks `Uint8Array`; `synthesizeSpeech` agrega um áudio completo e devolve `{audio,contentType,outputFormat,modelId}`. O adaptador suporta MP3 44,1 kHz em 128/64 kbps e PCM mono 24 kHz/16 bits. PCM cru não tem cabeçalho WAV e precisa de um reprodutor compatível.

A conexão posterior deve manter a chave no processo principal, enfileirar trechos de resposta, cancelar a geração e a reprodução quando houver interrupção e descartar áudio de uma geração antiga. A pulsação deve seguir o som efetivamente reproduzido. Não basta ligar `streamSpeech` para prometer uma conversa completa; ainda faltam coordenação com STT/LLM, reprodução, buffering e ensaio de interrupção.

## Limites locais e testes

O adaptador aplica limites locais de WAV até 10 MiB, 1–180 segundos, PCM ou float de 1–2 canais; texto até 4.000 caracteres por pedido; áudio até 16 MiB; timeout padrão de dois minutos. Esses limites são escolhas do aplicativo, não uma declaração dos limites de todos os planos do provedor. Cancelar pode interromper transporte e reprodução local futura sem garantir o desfazimento de um processamento já aceito pela conta.

`node --test tests/elevenlabs.test.mjs` cobre consentimento antes de leitura, WAV e limites, multipart, chave restrita ao header, erros seguros, verificação pendente, chunks progressivos, parâmetros de voz explícitos, abort de clonagem e áudio, timeout, saída privada e descarte de parciais. A suíte usa dados e rede simulados. Esses testes não enviaram a gravação pessoal, não criaram uma voz e não geraram cobrança. A clonagem, o download e a aprovação auditiva pelo autor foram registrados separadamente acima.
