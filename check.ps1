$files = @(
  "js/data/levelsData.js",
  "js/data/charactersData.js",
  "js/engine/AudioEngine.js",
  "js/entities/Environment.js",
  "js/entities/Player.js",
  "js/entities/HellHounds.js",
  "js/entities/Bosses.js",
  "js/engine/WeatherSystem.js",
  "js/main.js"
)
foreach ($file in $files) {
    if (Test-Path $file) {
        $c = [System.IO.File]::ReadAllText((Resolve-Path $file))
        $curly = [regex]::Matches($c, "\{").Count - [regex]::Matches($c, "\}").Count
        $round = [regex]::Matches($c, "\(").Count - [regex]::Matches($c, "\)").Count
        $square = [regex]::Matches($c, "\[").Count - [regex]::Matches($c, "\]").Count
        Write-Host "$file => curly: $curly, round: $round, square: $square"
    } else {
        Write-Host "File not found: $file"
    }
}
