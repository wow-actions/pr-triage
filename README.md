# PR Triage

> Automatically labelling PR depending on the PR's status.

## Usage

Create a `.github/workflows/pr-triage.yml` file in you repository.

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
      - uses: wow-actions/pr-triage@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

![workflow](screenshots/workflow.png)

Only watching the most recent commit :eyes::

- Do nothing when the PR's title starts from `WIP`, `[WIP]` or `WIP:`.
- Add the `PR: unreviewed` label when the PR does not have any reviews.
- Add the `PR: reviewed-changes-requested` label when the PR has reviewed and got `Change request` event.
- Add the `PR: review-approved` label when the PR has reviewed and got `Approve` event.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
