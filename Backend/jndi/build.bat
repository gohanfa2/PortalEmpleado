@echo off
REM Compila GnosisJndiFactory (InitialContextFactory para JasperStarter).
REM Requiere un JDK (javac y jar) accesible desde el PATH.
REM Uso: build.bat
setlocal enabledelayedexpansion
cd /d "%~dp0"

where javac >nul 2>&1
if errorlevel 1 (
  echo ERROR: no se encontro javac en el PATH. Instala un JDK 8 o superior.
  exit /b 1
)

if not exist "classes" mkdir "classes"

javac -source 1.8 -target 1.8 -nowarn -d classes ^
  src\com\colsin\gnosis\jndi\GnosisJndiFactory.java
if errorlevel 1 (
  echo ERROR: fallo la compilacion
  exit /b 1
)

if exist GnosisJndi.jar del GnosisJndi.jar
jar cf GnosisJndi.jar -C classes com
if errorlevel 1 (
  echo ERROR: fallo el empaquetado
  exit /b 1
)

echo Listo: GnosisJndi.jar
endlocal
