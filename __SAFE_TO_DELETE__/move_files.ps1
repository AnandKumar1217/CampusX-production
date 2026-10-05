$safeDir = "C:\Users\tammi\OneDrive\Downloads\CampusX-production\__SAFE_TO_DELETE__"
$manifestPath = "$safeDir\cleanup_manifest.csv"

$filesToMove = @(
    "CampusX-v1.0.0-RC1.apk", "CampusX-v1.0.0-RC2.apk", "CampusX-v1.0.0-RC3.apk", "CampusX-v1.0.0-RC4.apk", "CampusX-v1.0.0-RC5.apk",
    "audit_runner.mjs", "capture_phase2.mjs", "check.js", "compare_phase2.mjs", "crash_log.txt", "fix_backend_sgpa.mjs",
    "fix_people.mjs", "fix_social.mjs", "fix_stats.mjs", "fix_symbols.mjs", "fix-date.js", "fix.js", "fsck.txt", "generate_report.js",
    "lint.log", "logcat_dump.txt", "logcat_filtered.txt", "logcat.txt", "make_transparent.mjs", "marketplaceRouter.txt", "measure.ts",
    "patch.js", "qa_audit_script.mjs", "recent_logcat.txt", "replace-keys.js", "rewrite_commerce.js", "smoke_test.mjs",
    "splash_diff.png", "splash_test.png", "test_weather.json", "verify_splash.mjs",
    "apps/mobile/crash_log.txt", "apps/mobile/eas_inspect.log", "apps/mobile/fix-games.js", "apps/mobile/fix-onquit.js",
    "apps/mobile/logcat1.txt", "apps/mobile/logcat2.txt", "apps/mobile/logcat3.txt", "apps/mobile/patch.js", "apps/mobile/rn_config.json",
    "apps/mobile/test-chat.js", "apps/mobile/testNav.js", "apps/mobile/testNav.ts", "apps/mobile/ts-errors.log", "apps/mobile/verify-phase-4-1.js",
    "apps/backend/check-db.js", "apps/backend/scratch_check_prod.js", "apps/backend/scratch_db.js", "apps/backend/scratch_hashes.js",
    "apps/backend/scratch_pwd.js", "apps/backend/scratch_query.js", "apps/backend/scratch_query2.js", "apps/backend/scratch_query3.js",
    "apps/backend/scratch_query4.js", "apps/backend/scratch_test_db.js", "apps/backend/test-update.js",
    "scratch"
)

foreach ($f in $filesToMove) {
    if (Test-Path $f) {
        $item = Get-Item $f
        $isTracked = "untracked"
        if (git ls-files --error-unmatch $f 2>$null) {
            $isTracked = "tracked"
        }

        if ($item.PSIsContainer) {
            $targetDir = "$safeDir\agent-scratch"
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
            Move-Item -Path $f -Destination $targetDir -Force
            $size = "{0:N2} MB" -f ((Get-ChildItem $targetDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB)
            $csvLine = "$f,$targetDir\$($item.Name),$isTracked,dir,$size,agent scratch folder,NO_RESULTS,pass,pass,MOVE"
            Add-Content -Path $manifestPath -Value $csvLine
        } else {
            # Determine category subfolder based on extension/name
            $cat = "temporary-files"
            if ($f -match "\.apk$") { $cat = "old-builds" }
            elseif ($f -match "\.log$|\.txt$|logcat") { $cat = "logs" }
            elseif ($f -match "\.png$|\.jpg$") { $cat = "reference-images" }
            elseif ($f -match "scratch|fix|patch|check|test|measure|replace|rewrite") { $cat = "agent-scratch" }
            
            # preserve structure
            $relPath = Split-Path $f -Parent
            if ($relPath -eq "") { $relPath = "." }
            $targetDir = "$safeDir\$cat\from_repo\$relPath"
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
            Move-Item -Path $f -Destination $targetDir -Force
            
            $size = "{0:N2} KB" -f ($item.Length / 1KB)
            $csvLine = "$f,$targetDir\$($item.Name),$isTracked,file,$size,abandoned dev file,NO_RESULTS,pass,pass,MOVE"
            Add-Content -Path $manifestPath -Value $csvLine
        }
    }
}
