import typer
import sys
import os
import json
import asyncio
from typing import Optional
from pathlib import Path

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from analyzer import Analyzer

app = typer.Typer(
    help="Program Totality Analyzer - Generate comprehensive technical dossiers for software projects.",
    add_completion=False,
)


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """Program Totality Analyzer CLI."""
    if ctx.invoked_subcommand is None:
        typer.echo(ctx.get_help())
        raise typer.Exit(0)


@app.command("analyze")
def analyze(
    target: Optional[str] = typer.Argument(None, help="GitHub URL or local path to analyze"),
    output_dir: str = typer.Option(..., "--output-dir", "-o", help="Directory to write output files"),
    replit: bool = typer.Option(False, "--replit", help="Analyze current Replit workspace"),
    root: Optional[str] = typer.Option(None, "--root", help="Subdirectory within target to scope analysis"),
):
    """
    Analyze a software project and generate a dossier.

    Supports three modes:
    - GitHub repo: analyze https://github.com/user/repo -o ./out
    - Local folder: analyze ./some-folder -o ./out
    - Replit workspace: analyze --replit -o ./out
    """
    console = Analyzer.get_console()

    if replit:
        mode = "replit"
        source = os.getcwd()
        console.print(f"[bold green]Replit mode:[/bold green] Analyzing current workspace at {source}")
    elif target and (target.startswith("http://") or target.startswith("https://") or target.startswith("git@")):
        mode = "github"
        source = target
        console.print(f"[bold green]GitHub mode:[/bold green] Analyzing {source}")
    elif target and os.path.isdir(target):
        mode = "local"
        source = os.path.abspath(target)
        console.print(f"[bold green]Local mode:[/bold green] Analyzing {source}")
    else:
        console.print("[bold red]Error:[/bold red] Provide a GitHub URL, local path, or use --replit")
        raise typer.Exit(code=1)

    try:
        analyzer = Analyzer(source, output_dir, mode=mode, root=root)
        asyncio.run(analyzer.run())
        console.print(f"[bold green]Analysis complete![/bold green] Results in {output_dir}")
    except Exception as e:
        console.print(f"[bold red]Error during analysis:[/bold red] {str(e)}")
        import traceback
        traceback.print_exc()
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
