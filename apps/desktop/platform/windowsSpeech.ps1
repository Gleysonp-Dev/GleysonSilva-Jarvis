$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
  Add-Type -AssemblyName System.Speech
  # Event handlers run in managed code so they do not depend on a PowerShell runspace.
  $wakeReferences = @([System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location, [Console].Assembly.Location, [System.Threading.Monitor].Assembly.Location) | Select-Object -Unique
  Add-Type -ReferencedAssemblies $wakeReferences -TypeDefinition @'
using System;
using System.Globalization;
using System.Speech.Recognition;

public static class JarvisLocalWake {
  private static readonly object OutputLock = new object();
  private static DateTime lastWake = DateTime.MinValue;
  private static void Emit(string value) {
    lock (OutputLock) { Console.WriteLine(value); Console.Out.Flush(); }
  }
  public static void Run() {
    var installed = SpeechRecognitionEngine.InstalledRecognizers();
    if (installed.Count == 0) { Emit("{\"type\":\"unavailable\",\"reason\":\"speech_engine_missing\"}"); return; }
    RecognizerInfo selected = installed[0];
    foreach (var engine in installed) {
      if (engine.Culture.Name.Equals("en-US", StringComparison.OrdinalIgnoreCase)) selected = engine;
    }
    foreach (var engine in installed) {
      if (engine.Culture.Name.Equals("pt-BR", StringComparison.OrdinalIgnoreCase)) { selected = engine; break; }
    }
    using (var recognizer = new SpeechRecognitionEngine(selected.Id)) {
      var builder = new GrammarBuilder();
      builder.Culture = selected.Culture;
      builder.Append("Jarvis");
      var grammar = new Grammar(builder);
      grammar.Name = "JarvisWakeWord";
      recognizer.LoadGrammar(grammar);
      recognizer.SpeechRecognized += delegate(object sender, SpeechRecognizedEventArgs e) {
        if (!String.Equals(e.Result.Text, "Jarvis", StringComparison.OrdinalIgnoreCase) || e.Result.Confidence < 0.72f) return;
        var now = DateTime.UtcNow;
        lock (OutputLock) {
          if ((now - lastWake).TotalMilliseconds < 2500) return;
          lastWake = now;
          Emit("{\"type\":\"wake\",\"keyword\":\"Jarvis\",\"confidence\":" + e.Result.Confidence.ToString("0.0000", CultureInfo.InvariantCulture) + "}");
        }
      };
      try { recognizer.SetInputToDefaultAudioDevice(); }
      catch { Emit("{\"type\":\"unavailable\",\"reason\":\"microphone_unavailable\"}"); return; }
      try {
        recognizer.RecognizeAsync(RecognizeMode.Multiple);
        Emit("{\"type\":\"ready\",\"culture\":\"" + selected.Culture.Name + "\"}");
        string command;
        while ((command = Console.ReadLine()) != null) { if (command == "STOP") break; }
      } finally {
        recognizer.RecognizeAsyncCancel();
        recognizer.SetInputToNull();
      }
    }
  }
}
'@
  [JarvisLocalWake]::Run()
} catch {
  [Console]::WriteLine('{"type":"unavailable","reason":"speech_initialization_failed"}')
  [Console]::Out.Flush()
  exit 1
}
