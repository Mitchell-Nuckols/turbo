import { TurboDriveTestCase } from "../helpers/turbo_drive_test_case"

export class FormSubmissionTests extends TurboDriveTestCase {
  async setup() {
    await this.goToLocation("/src/tests/fixtures/form.html")
  }

  async "test standard form submission with redirect response"() {
    const button = await this.querySelector("#standard form input[type=submit]")
    await button.click()
    await this.nextBody

    this.assert.equal(await this.pathname, "/src/tests/fixtures/one.html")
    this.assert.equal(await this.visitAction, "advance")
  }

  async "test submitter form submission reads button attributes"() {
    const button = await this.querySelector("#submitter form button[type=submit]")
    await button.click()
    await this.nextBody

    this.assert.equal(await this.pathname, "/src/tests/fixtures/two.html")
    this.assert.equal(await this.visitAction, "advance")
  }

  async "test frame form submission with redirect response"() {
    const button = await this.querySelector("#frame form.redirect input[type=submit]")
    await button.click()
    await this.nextBeat

    const message = await this.querySelector("#frame div.message")
    this.assert.notOk(await this.hasSelector("#frame form.redirect"))
    this.assert.equal(await message.getVisibleText(), "Frame redirected")
    this.assert.equal(await this.pathname, "/src/tests/fixtures/form.html")
  }

  async "test frame form submission with stream response"() {
    const button = await this.querySelector("#frame form.stream input[type=submit]")
    await button.click()
    await this.nextBeat

    const message = await this.querySelector("#frame div.message")
    this.assert.ok(await this.hasSelector("#frame form.redirect"))
    this.assert.equal(await message.getVisibleText(), "Hello!")
    this.assert.equal(await this.pathname, "/src/tests/fixtures/form.html")
  }

  async "test form submission with Turbo disabled on the form"() {
    this.listenForFormSubmissions()
    await this.clickSelector('#disabled form[data-turbo="false"] input[type=submit]')
    await this.nextBody
    await this.querySelector("#element-id")

    this.assert.notOk(await this.turboFormSubmitted)
  }

  async "test form submission with Turbo disabled on the submitter"() {
    this.listenForFormSubmissions()
    await this.clickSelector('#disabled form:not([data-turbo]) input[data-turbo="false"]')
    await this.nextBody
    await this.querySelector("#element-id")

    this.assert.notOk(await this.turboFormSubmitted)
  }

  async "test form submission skipped within method=dialog"() {
    this.listenForDialogButtons()
    this.listenForFormSubmissions()
    await this.clickSelector('button[data-open="dialog-method"]')
    await this.clickSelector('#dialog-method [type="submit"]')
    await this.nextBeat

    this.assert.notOk(await this.turboFormSubmitted)
    this.assert.notOk(await this.hasSelector("#dialog-method[open]"))
  }

  async "test form submission skipped with submitter formmethod=dialog"() {
    this.listenForDialogButtons()
    this.listenForFormSubmissions()
    await this.clickSelector('button[data-open="dialog-formmethod"]')
    await this.clickSelector('#dialog-formmethod [formmethod="dialog"]')
    await this.nextBeat

    this.assert.notOk(await this.turboFormSubmitted)
    this.assert.notOk(await this.hasSelector("#dialog-formmethod[open]"))
  }

  listenForFormSubmissions() {
    this.remote.execute(() => addEventListener("turbo:submit-start", function eventListener(event) {
      removeEventListener("turbo:submit-start", eventListener, false)
      document.head.insertAdjacentHTML("beforeend", `<meta name="turbo-form-submitted">`)
    }, false))
  }

  listenForDialogButtons() {
    this.remote.execute(() => addEventListener("click", ({ target }) => {
      if (target instanceof HTMLElement) {
        const id = target?.getAttribute("data-open")
        const dialog = document.querySelector("dialog#" + id)

        if (dialog instanceof HTMLDialogElement) dialog.showModal()
      }
    }))
  }

  get turboFormSubmitted(): Promise<boolean> {
    return this.hasSelector("meta[name=turbo-form-submitted]")
  }
}

FormSubmissionTests.registerSuite()
