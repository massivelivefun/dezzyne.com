import { type Branded, type SafeRelativeHref } from "./shader-lib.ts";

type LocalizedMessage = Branded<string, "LocalizedMessage">;
type EncodedFormPayload = Branded<string, "EncodedFormPayload">;
type MinimumLength = Branded<number, "MinimumLength">;
type FieldKind = "text" | "email";
type TextControl = HTMLInputElement | HTMLTextAreaElement;

interface ValidationMessages {
    readonly required: LocalizedMessage;
    readonly invalidEmail: LocalizedMessage;
    readonly tooShort: LocalizedMessage;
    readonly sendError: LocalizedMessage;
    readonly thanksBody: LocalizedMessage;
}

interface ContactFieldBinding {
    readonly control: TextControl;
    readonly errorNode: HTMLElement;
    readonly kind: FieldKind;
    readonly minimumLength: MinimumLength;
}

function asLocalizedMessage(rawText: string): LocalizedMessage {
    return rawText as LocalizedMessage;
}

function asEncodedPayload(rawPayload: string): EncodedFormPayload {
    return rawPayload as EncodedFormPayload;
}

function asMinimumLength(rawLength: number): MinimumLength {
    return rawLength as MinimumLength;
}

const EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY_MESSAGE: LocalizedMessage = asLocalizedMessage("");

function readDataMessage(
    formElement: HTMLFormElement,
    attributeName: string,
    fallbackText: string
): LocalizedMessage {
    const attributeValue: string | null =
        formElement.getAttribute(attributeName);
    if (attributeValue !== null && attributeValue.length > 0) {
        return asLocalizedMessage(attributeValue);
    }
    return asLocalizedMessage(fallbackText);
}

function readValidationMessages(
    formElement: HTMLFormElement
): ValidationMessages {
    return {
        required: readDataMessage(
            formElement,
            "data-error-required",
            "Required"
        ),
        invalidEmail: readDataMessage(
            formElement,
            "data-error-email",
            "Invalid email"
        ),
        tooShort: readDataMessage(
            formElement,
            "data-error-short",
            "Too short"
        ),
        sendError: readDataMessage(
            formElement,
            "data-error-send",
            "Could not send message. Please try again."
        ),
        thanksBody: readDataMessage(
            formElement,
            "data-thanks-body",
            "Thanks for reaching out."
        ),
    };
}

function isTextControl(candidate: Element | null): candidate is TextControl {
    return (
        candidate instanceof HTMLInputElement ||
        candidate instanceof HTMLTextAreaElement
    );
}

function bindContactField(
    controlId: string,
    errorId: string,
    kind: FieldKind,
    minimumLength: MinimumLength
): ContactFieldBinding | null {
    const controlNode: Element | null = document.getElementById(controlId);
    const errorNode: HTMLElement | null = document.getElementById(errorId);
    if (!isTextControl(controlNode) || errorNode === null) {
        return null;
    }
    return {
        control: controlNode,
        errorNode,
        kind,
        minimumLength,
    };
}

function collectFieldBindings(): readonly ContactFieldBinding[] | null {
    const nameField: ContactFieldBinding | null = bindContactField(
        "name",
        "error-name",
        "text",
        asMinimumLength(2)
    );
    const emailField: ContactFieldBinding | null = bindContactField(
        "email",
        "error-email",
        "email",
        asMinimumLength(2)
    );
    const topicField: ContactFieldBinding | null = bindContactField(
        "topic",
        "error-topic",
        "text",
        asMinimumLength(2)
    );
    const messageField: ContactFieldBinding | null = bindContactField(
        "message",
        "error-message",
        "text",
        asMinimumLength(10)
    );
    if (
        nameField === null ||
        emailField === null ||
        topicField === null ||
        messageField === null
    ) {
        return null;
    }
    return [nameField, emailField, topicField, messageField];
}

function evaluateFieldError(
    binding: ContactFieldBinding,
    messages: ValidationMessages
): LocalizedMessage {
    const trimmedValue: string = binding.control.value.trim();
    if (trimmedValue.length === 0) {
        return messages.required;
    }
    if (binding.kind === "email" && !EMAIL_PATTERN.test(trimmedValue)) {
        return messages.invalidEmail;
    }
    if (trimmedValue.length < binding.minimumLength) {
        return messages.tooShort;
    }
    return EMPTY_MESSAGE;
}

function applyFieldValidation(
    binding: ContactFieldBinding,
    messages: ValidationMessages
): boolean {
    const warningText: LocalizedMessage = evaluateFieldError(
        binding,
        messages
    );
    binding.errorNode.textContent = warningText;
    if (warningText.length > 0) {
        binding.control.setAttribute("aria-invalid", "true");
        return false;
    }
    binding.control.removeAttribute("aria-invalid");
    return true;
}

function shouldRevalidateOnInput(
    binding: ContactFieldBinding,
    hasAttemptedSubmit: boolean
): boolean {
    return (
        hasAttemptedSubmit ||
        binding.control.getAttribute("aria-invalid") === "true"
    );
}

function validateAllFields(
    bindings: readonly ContactFieldBinding[],
    messages: ValidationMessages
): boolean {
    let allValid: boolean = true;
    for (
        let fieldIndex: number = 0;
        fieldIndex < bindings.length;
        fieldIndex++
    ) {
        const fieldValid: boolean = applyFieldValidation(
            bindings[fieldIndex],
            messages
        );
        allValid = allValid && fieldValid;
    }
    return allValid;
}

function serializeContactForm(
    formElement: HTMLFormElement
): EncodedFormPayload {
    const searchParams: URLSearchParams = new URLSearchParams();
    const formData: FormData = new FormData(formElement);
    for (const [entryName, entryValue] of formData.entries()) {
        if (typeof entryValue === "string") {
            searchParams.append(entryName, entryValue);
        }
    }
    return asEncodedPayload(searchParams.toString());
}

function resolveActionPath(formElement: HTMLFormElement): SafeRelativeHref {
    const rawAction: string | null = formElement.getAttribute("action");
    if (
        rawAction !== null &&
        rawAction.startsWith("/") &&
        !rawAction.startsWith("//")
    ) {
        return rawAction as SafeRelativeHref;
    }
    return "/contact/" as SafeRelativeHref;
}

function isAcceptedSubmitResponse(response: Response): boolean {
    if (response.ok) {
        return true;
    }
    const hostname: string = window.location.hostname;
    const isLoopback: boolean =
        hostname === "localhost" || hostname === "127.0.0.1";
    return isLoopback && (response.status === 404 || response.status === 405);
}

function setControlsReadOnly(
    bindings: readonly ContactFieldBinding[],
    readOnlyState: boolean
): void {
    for (
        let fieldIndex: number = 0;
        fieldIndex < bindings.length;
        fieldIndex++
    ) {
        bindings[fieldIndex].control.readOnly = readOnlyState;
    }
}

function showThankYouState(
    submitButton: HTMLButtonElement,
    statusNode: HTMLElement,
    thanksBody: LocalizedMessage
): void {
    statusNode.classList.remove("form-status--error");
    statusNode.textContent = thanksBody;
    submitButton.hidden = true;
    statusNode.hidden = false;
}

function showSendErrorState(
    bindings: readonly ContactFieldBinding[],
    submitButton: HTMLButtonElement,
    statusNode: HTMLElement,
    sendError: LocalizedMessage
): void {
    setControlsReadOnly(bindings, false);
    submitButton.disabled = false;
    submitButton.hidden = false;
    statusNode.classList.add("form-status--error");
    statusNode.textContent = sendError;
    statusNode.hidden = false;
}

async function submitFormPayload(
    actionPath: SafeRelativeHref,
    encodedPayload: EncodedFormPayload
): Promise<boolean> {
    try {
        const response: Response = await fetch(actionPath, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: encodedPayload,
        });
        return isAcceptedSubmitResponse(response);
    } catch {
        return false;
    }
}

function initializeContactForm(): void {
    const formCandidate: Element | null =
        document.querySelector("form.contact-form");
    const submitCandidate: Element | null =
        document.querySelector("button.btn-submit");
    const statusNode: HTMLElement | null =
        document.getElementById("form-status");
    const bindings: readonly ContactFieldBinding[] | null =
        collectFieldBindings();
    if (
        !(formCandidate instanceof HTMLFormElement) ||
        !(submitCandidate instanceof HTMLButtonElement) ||
        statusNode === null ||
        bindings === null
    ) {
        return;
    }

    const formElement: HTMLFormElement = formCandidate;
    const submitButton: HTMLButtonElement = submitCandidate;
    const messages: ValidationMessages = readValidationMessages(formElement);
    let hasAttemptedSubmit: boolean = false;
    let isSubmitting: boolean = false;
    let isSubmitted: boolean = false;

    for (
        let fieldIndex: number = 0;
        fieldIndex < bindings.length;
        fieldIndex++
    ) {
        const currentBinding: ContactFieldBinding = bindings[fieldIndex];
        currentBinding.control.addEventListener("input", (): void => {
            if (!shouldRevalidateOnInput(currentBinding, hasAttemptedSubmit)) {
                return;
            }
            applyFieldValidation(currentBinding, messages);
        });
    }

    formElement.addEventListener(
        "submit",
        (submitEvent: SubmitEvent): void => {
            submitEvent.preventDefault();
            if (isSubmitting || isSubmitted) {
                return;
            }
            hasAttemptedSubmit = true;
            statusNode.hidden = true;
            statusNode.textContent = "";
            const isFormValid: boolean = validateAllFields(bindings, messages);
            if (!isFormValid) {
                return;
            }
            const encodedPayload: EncodedFormPayload =
                serializeContactForm(formElement);
            const actionPath: SafeRelativeHref =
                resolveActionPath(formElement);
            isSubmitting = true;
            submitButton.disabled = true;
            setControlsReadOnly(bindings, true);
            void submitFormPayload(actionPath, encodedPayload).then(
                (didSucceed: boolean): void => {
                    isSubmitting = false;
                    if (didSucceed) {
                        isSubmitted = true;
                        showThankYouState(
                            submitButton,
                            statusNode,
                            messages.thanksBody
                        );
                        return;
                    }
                    showSendErrorState(
                        bindings,
                        submitButton,
                        statusNode,
                        messages.sendError
                    );
                }
            );
        }
    );
}

initializeContactForm();
