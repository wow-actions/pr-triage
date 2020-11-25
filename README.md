# PR Triage

> GitHub action to add a label depending on the pull request's status.

## Usage

Create a `.github/workflows/pr-triage.yml` file in the repository you want to install this action, then add the following to it:

```yml
name: PR Triage
on:
  pull_request:
    types: [opened, closed, edited, reopened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted, dismissed]
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: bubkoo/pr-triage@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
