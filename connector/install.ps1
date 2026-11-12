param([string]$Config = (Join-Path $PSScriptRoot 'config.json'))
$ErrorActionPreference = 'Stop'
$configPath = (Resolve-Path $Config).Path
$settings = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
if (-not ($settings.crm_url -match '^https://')) { throw 'crm_url must use HTTPS.' }
if (-not (Test-Path -LiteralPath $settings.base_cases_dir -PathType Container)) { throw 'The Synology Cases folder must already exist.' }
$python = (Get-Command pythonw.exe -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'connector.py'
$action = New-ScheduledTaskAction -Execute $python -Argument "`"$script`" --config `"$configPath`"" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$options = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName 'CPH Folder Connector' -Action $action -Trigger $trigger -Settings $options -Description 'Creates CRM case folders in Synology using outbound HTTPS.' -Force | Out-Null
$desktop = [Environment]::GetFolderPath('Desktop')
$crmUrl = $settings.crm_url.TrimEnd('/') + '/case-generator'
Set-Content -LiteralPath (Join-Path $desktop 'CPH Case Generator.url') -Value "[InternetShortcut]`r`nURL=$crmUrl" -Encoding ASCII
Start-ScheduledTask -TaskName 'CPH Folder Connector'
Write-Host 'Connector installed for this Windows user. The Case Generator shortcut opens CRM staff sign-in.'
