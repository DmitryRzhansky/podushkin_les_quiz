(function () {
  "use strict";

  const config = window.QUIZ_CONFIG || {};
  const dictionaries = window.QUIZ_I18N || {};
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const state = {
    language: "ru",
    step: "plot",
    answers: { plot: "", purpose: "", term: "", visit: "" },
    form: { surname: "", firstName: "", phone: "", consent: false },
    submitting: false
  };

  const t = (key, variables) => {
    const language = dictionaries[state.language] || dictionaries.ru || {};
    let value = language[key] || (dictionaries.ru && dictionaries.ru[key]) || key;
    if (variables) Object.keys(variables).forEach((name) => { value = value.replace("{" + name + "}", String(variables[name])); });
    return value;
  };
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const imagePath = (file) => "assets/images/" + file;
  const leadDialog = $("#lead-dialog");
  const leadDialogContent = $("#lead-dialog-content");
  const schemeDialog = $("#scheme-dialog");
  const initialLeadDialogMarkup = leadDialogContent ? leadDialogContent.innerHTML : "";

  const land = {
    "95": {
      area: "9,5 га",
      title: "result_95_title",
      subtitle: "result_95_text",
      main: { file: "field-95-main.webp", alt: "alt_95_main", kind: "photo" },
      images: [
        { file: "field-95-secondary.webp", alt: "alt_95_secondary", kind: "photo" },
        { file: "boundary-scheme.webp", alt: "alt_scheme_95", kind: "scheme" }
      ],
      cadastre: "result_95_cadastre"
    },
    "74": {
      area: "7,4 га",
      title: "result_74_title",
      subtitle: "result_74_text",
      main: { file: "field-74-access.webp", alt: "alt_74_main", kind: "photo" },
      images: [
        { file: "visit-plots.webp", alt: "alt_visit", kind: "photo" },
        { file: "field-74-boundary.webp", alt: "alt_scheme_74", kind: "scheme" }
      ],
      cadastre: "result_74_cadastre"
    }
  };

  const plotOptions = [
    { value: "95", title: "plot_95_choice", description: "plot_95_choice_desc", image: "field-95-main.webp", alt: "alt_95_main" },
    { value: "74", title: "plot_74_choice", description: "plot_74_choice_desc", image: "field-74-access.webp", alt: "alt_74_main" },
    { value: "both", title: "plot_both_choice", description: "plot_both_choice_desc", image: "plots-together.webp", alt: "alt_both" }
  ];
  const purposeOptions = [
    { value: "greenhouse", title: "purpose_greenhouse", icon: "fa-seedling" },
    { value: "livestock", title: "purpose_livestock", icon: "fa-cow" },
    { value: "tourism", title: "purpose_tourism", icon: "fa-campground" },
    { value: "production", title: "purpose_production", icon: "fa-warehouse" },
    { value: "other", title: "purpose_other", icon: "fa-circle-question" }
  ];
  const termOptions = [
    { value: "3-5", title: "term_3_5", description: "term_3_5_desc", icon: "fa-hourglass-half" },
    { value: "5-10", title: "term_5_10", description: "term_5_10_desc", icon: "fa-calendar-days" },
    { value: "10+", title: "term_10_plus", description: "term_10_plus_desc", icon: "fa-calendar-check" },
    { value: "unsure", title: "term_unsure", description: "term_unsure_desc", icon: "fa-circle-question" }
  ];
  const visitOptions = [
    { value: "soon", title: "visit_soon", icon: "fa-calendar-day" },
    { value: "two_weeks", title: "visit_two_weeks", icon: "fa-calendar-week" },
    { value: "month", title: "visit_month", icon: "fa-calendar-days" },
    { value: "later", title: "visit_later", icon: "fa-clock" },
    { value: "remote", title: "visit_remote", icon: "fa-laptop" }
  ];

  function optionLabel(group, value) {
    if (group === "plot") {
      if (value === "both") return t("plot_both_choice");
      if (value === "help") return t("plot_help_choice");
      return t("plot_" + value + "_choice");
    }
    const source = group === "purpose" ? purposeOptions : group === "term" ? termOptions : visitOptions;
    const found = source.find((item) => item.value === value);
    return found ? t(found.title) : t("not_selected");
  }

  function selected(group, value) {
    return state.answers[group] === value;
  }

  function imageOption(item) {
    const isSelected = selected("plot", item.value);
    return '<label class="plot-choice' + (isSelected ? " is-selected" : "") + '">' +
      '<input class="visually-hidden choice-input" type="radio" name="plot" value="' + esc(item.value) + '"' +
      (isSelected ? " checked" : "") + '>' +
      '<span class="selection-check" aria-hidden="true"><i class="fa-solid fa-check"></i></span>' +
      '<img src="' + imagePath(item.image) + '" alt="' + esc(t(item.alt)) + '" loading="lazy">' +
      '<span class="plot-choice-content"><span class="plot-choice-top"><strong>' + t(item.title) +
      '</strong></span><span class="plot-choice-description">' +
      t(item.description) + '</span></span></label>';
  }

  function textOption(group, item) {
    const isSelected = selected(group, item.value);
    return '<label class="answer-choice' + (isSelected ? " is-selected" : "") + '">' +
      '<input class="visually-hidden choice-input" type="radio" name="' + group + '" value="' + esc(item.value) + '"' +
      (isSelected ? " checked" : "") + '><span class="answer-choice-icon" aria-hidden="true"><i class="fa-solid ' +
      item.icon + '"></i></span><span class="answer-choice-copy"><strong>' + t(item.title) +
      (item.description ? '</strong><small>' + t(item.description) + '</small>' : '</strong>') +
      '</span><span class="selection-check" aria-hidden="true"><i class="fa-solid fa-check"></i></span></label>';
  }

  function question(titleKey, textKey) {
    const description = textKey ? '<p>' + t(textKey) + '</p>' : '';
    return '<div class="question-heading"><h1 id="current-question" tabindex="-1">' + t(titleKey) + '</h1>' + description + '</div>';
  }

  function navigation(back, canContinue, skip) {
    const backButton = back
      ? '<button type="button" class="nav-back" data-action="back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i>' + t("button_back") + '</button>'
      : "";
    const skipButton = skip
      ? '<button type="button" class="nav-skip" data-action="skip">' + t("button_skip") + '</button>'
      : "";
    const continueButton = ["plot", "purpose", "term", "visit"].includes(state.step)
      ? '<button type="button" class="nav-next" data-action="continue"' + (canContinue ? "" : " disabled") + '>' + t("button_continue") + '<i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>'
      : "";
    const founderSignature = continueButton
      ? '<aside class="founder-signature"><img src="' + imagePath("quiz-avatar.webp") + '" alt="' + esc(t("alt_avatar")) + '" width="64" height="64"><span class="founder-copy"><strong>' + t("founder_name") + '</strong><small>' + t("founder_role") + '</small></span></aside>'
      : "";
    const restartButton = state.step === "result"
      ? '<button type="button" class="nav-restart" data-action="restart"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' + t("button_restart") + '</button>'
      : "";
    if (!backButton && !skipButton && !restartButton && !continueButton) return "";
    return '<div class="question-actions">' + backButton + founderSignature + restartButton + skipButton + continueButton + '</div>';
  }

  function renderPlotStep() {
    const helpSelected = selected("plot", "help");
    const help = '<label class="plot-choice plot-choice-help' + (helpSelected ? " is-selected" : "") + '">' +
      '<input class="visually-hidden choice-input" type="radio" name="plot" value="help"' +
      (helpSelected ? " checked" : "") + '><span class="help-icon" aria-hidden="true"><i class="fa-solid fa-compass"></i></span>' +
      '<span class="plot-choice-content"><span class="plot-choice-top"><strong>' + t("plot_help_choice") +
      '</strong></span><span class="plot-choice-description">' + t("plot_help_choice_desc") + '</span></span>' +
      '<span class="selection-check" aria-hidden="true"><i class="fa-solid fa-check"></i></span></label>';
    return '<div class="step-pane">' + question("step_plot_title", "step_plot_help") +
      '<fieldset class="choices-fieldset"><legend class="visually-hidden">' + t("step_plot_title") + '</legend>' +
      '<div class="plot-choices">' + plotOptions.map(imageOption).join("") + help + '</div></fieldset>' +
      navigation("", Boolean(state.answers.plot), false) + '</div>';
  }

  function renderPurposeStep() {
    return '<div class="step-pane">' + question("step_purpose_title", "step_purpose_help") +
      '<fieldset class="choices-fieldset"><legend class="visually-hidden">' + t("step_purpose_title") + '</legend>' +
      '<div class="answer-choices purpose-choices">' + purposeOptions.map((item) => textOption("purpose", item)).join("") + '</div></fieldset>' +
      navigation("plot", Boolean(state.answers.purpose), false) + '</div>';
  }

  function renderTermStep() {
    return '<div class="step-pane">' + question("step_term_title", "step_term_help") +
      '<fieldset class="choices-fieldset"><legend class="visually-hidden">' + t("step_term_title") + '</legend>' +
      '<div class="answer-choices term-choices">' + termOptions.map((item) => textOption("term", item)).join("") + '</div></fieldset>' +
      navigation("purpose", Boolean(state.answers.term), false) + '</div>';
  }

  function renderVisitStep() {
    return '<div class="step-pane visit-pane">' + question("step_visit_title", "step_visit_help") +
      '<fieldset class="choices-fieldset"><legend class="visually-hidden">' + t("step_visit_title") + '</legend>' +
      '<div class="answer-choices visit-choices">' + visitOptions.map((item) => textOption("visit", item)).join("") + '</div></fieldset>' +
      navigation("term", Boolean(state.answers.visit), true) + '</div>';
  }

  function resultLandCard(id) {
    const item = land[id];
    const scheme = item.images.find((photo) => photo.kind === "scheme");
    return '<article class="result-property"><div class="result-property-media">' +
      '<img class="result-property-photo" src="' + imagePath(item.main.file) + '" alt="' + esc(t(item.main.alt)) + '" width="520" height="300">' +
      '<button type="button" class="scheme-thumb" data-action="zoom-scheme" data-scheme-src="' + imagePath(scheme.file) + '" data-scheme-alt="' + esc(t(scheme.alt)) + '" aria-label="' + esc(t("result_scheme_zoom")) + '"><img class="result-property-scheme" src="' + imagePath(scheme.file) + '" alt="" width="240" height="180"><span>' + t("result_scheme_caption") + '<i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i></span></button>' +
      '</div><div class="result-property-copy"><div class="result-property-title"><h4>' + t(item.title) +
      '</h4><span class="result-area">' + item.area + '</span></div><p>' + t(item.subtitle) + '</p>' +
      '<div class="result-cadastre"><span>' + t("result_cadastre_label") + '</span><strong>' + t(item.cadastre) + '</strong></div></div></article>';
  }

  function renderResultStep() {
    const selectedPlot = state.answers.plot;
    const headingKey = selectedPlot === "95" ? "result_heading_95"
      : selectedPlot === "74" ? "result_heading_74" : "result_heading_both";
    const ids = state.answers.plot === "95" ? ["95"] : state.answers.plot === "74" ? ["74"] : ["95", "74"];
    return '<div class="step-pane result-pane"><div class="result-heading"><h1 id="current-question" tabindex="-1">' + t(headingKey) + '</h1></div>' +
      '<div class="result-land-list">' + ids.map(resultLandCard).join("") + '</div>' +
      '<section class="result-contact-box"><div><h4>' + t("result_next_title") + '</h4><p>' + t("result_next_text") +
      '</p></div><button type="button" class="nav-next" data-action="to-contact">' + t("result_cta") +
      '<i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></section>' +
      navigation("visit", true, false) + '</div>';
  }

  function successMarkup() {
    const phone = config.representative && config.representative.phone || "+7 (924) 203-00-05";
    const phoneHref = config.representative && config.representative.phoneHref || "tel:+79242030005";
    return '<div class="step-pane success-pane"><span class="success-mark" aria-hidden="true"><i class="fa-solid fa-check"></i></span>' +
      '<h3 id="dialog-success-title" tabindex="-1">' + t("success_title") + '</h3><p>' + t("success_text") +
      '</p><p>' + t("success_contact") + ' <a href="' + esc(phoneHref) + '">' + esc(phone) + '</a></p>' +
      '<button class="nav-next" type="button" data-action="restart">' + t("button_restart") +
      '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button></div>';
  }

  function renderProgress() {
    const progress = $("#quiz-progress");
    if (!progress) return;
    const questions = ["plot", "purpose", "term", "visit"];
    const questionIndex = questions.indexOf(state.step);
    const isResult = state.step === "result";
    const current = questionIndex < 0 ? questions.length : questionIndex + 1;
    const total = questions.length;
    const percent = Math.round((current / total) * 100);
    const counterText = isResult ? t("result_step_label") : t("step_count", { current: current, total: total });
    progress.innerHTML = '<div class="progress-caption"><span id="panel-step">' + esc(counterText) + '</span></div>' +
      '<div class="progress-track" role="progressbar" aria-label="' + esc(t("progress_label")) +
      '" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="' + current + '">' +
      '<span class="progress-fill" style="width:' + percent + '%"></span></div>';
    progress.classList.toggle("is-complete", isResult);
  }

  function render() {
    renderProgress();
    const container = $("#step-container");
    if (!container) return;
    const markup = state.step === "plot" ? renderPlotStep()
      : state.step === "purpose" ? renderPurposeStep()
      : state.step === "term" ? renderTermStep()
      : state.step === "visit" ? renderVisitStep()
      : renderResultStep();
    container.innerHTML = markup;
  }

  function setLanguage(language, keepFocus) {
    if (!dictionaries[language]) return;
    const active = document.activeElement;
    const fieldName = keepFocus && active && active.getAttribute ? active.getAttribute("name") : "";
    state.language = language;
    document.documentElement.lang = language;
    document.title = t("document_title");
    $$("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (key) element.textContent = t(key);
    });
    $$("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.getAttribute("data-i18n-placeholder"));
    });
    $$("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.getAttribute("data-i18n-aria")));
    });
    $$(".language-switch").forEach((group) => group.setAttribute("aria-label", t("language_group")));
    $$(".language-button").forEach((button) => {
      const activeLanguage = button.dataset.language === language;
      button.classList.toggle("is-active", activeLanguage);
      button.setAttribute("aria-pressed", String(activeLanguage));
    });
    const labels = [
      ["field-95-main.webp", "alt_95_main"], ["field-74-access.webp", "alt_74_main"],
      ["plots-together.webp", "alt_both"], ["boundary-scheme.webp", "alt_scheme_95"],
      ["field-74-boundary.webp", "alt_scheme_74"], ["quiz-avatar.webp", "alt_avatar"]
    ];
    $$("img[src]").forEach((image) => {
      const source = image.getAttribute("src") || "";
      const match = labels.find((item) => source.indexOf(item[0]) >= 0);
      if (match) image.alt = t(match[1]);
    });
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
    render();
    if (fieldName) {
      const field = $('#step-container [name="' + fieldName + '"]');
      if (field && typeof field.focus === "function") field.focus({ preventScroll: true });
    }
  }

  function setStatus(kind, text, includeDirectContact) {
    const status = $("#submit-status");
    if (!status) return;
    status.dataset.kind = kind;
    status.hidden = false;
    status.textContent = "";
    const message = document.createElement("span");
    message.textContent = text;
    status.appendChild(message);
    if (includeDirectContact) {
      status.appendChild(document.createElement("br"));
      const phone = config.representative && config.representative.phone || "+7 (924) 203-00-05";
      const phoneHref = config.representative && config.representative.phoneHref || "tel:+79242030005";
      const phoneLink = document.createElement("a");
      phoneLink.href = phoneHref;
      phoneLink.textContent = phone;
      status.appendChild(phoneLink);
      const email = config.representative && config.representative.email || "sas-as@inbox.ru";
      status.appendChild(document.createTextNode(" · "));
      const emailLink = document.createElement("a");
      emailLink.href = "mailto:" + email;
      emailLink.textContent = email;
      status.appendChild(emailLink);
    }
  }

  function focusQuestion() {
    const heading = $("#current-question");
    if (heading) heading.focus({ preventScroll: true });
  }

  function showStep(step) {
    state.step = step;
    render();
    focusQuestion();
    if (window.matchMedia("(max-width: 760px)").matches) {
      $("#quiz").scrollIntoView({ behavior: "auto", block: "start" });
    }
  }

  function continueForward() {
    if (state.step === "plot" && state.answers.plot) showStep("purpose");
    else if (state.step === "purpose" && state.answers.purpose) showStep("term");
    else if (state.step === "term" && state.answers.term) showStep("visit");
    else if (state.step === "visit") showStep("result");
  }

  function goBack() {
    const previous = {
      purpose: "plot", term: "purpose", visit: "term", result: "visit"
    }[state.step];
    if (previous) showStep(previous);
  }

  function restart() {
    state.answers = { plot: "", purpose: "", term: "", visit: "" };
    state.form = { surname: "", firstName: "", phone: "", consent: false };
    state.submitting = false;
    if (leadDialog && leadDialog.open) leadDialog.close();
    if (leadDialogContent) leadDialogContent.innerHTML = initialLeadDialogMarkup;
    if (leadDialog) leadDialog.setAttribute("aria-label", t("contact_step_title"));
    showStep("plot");
    setLanguage(state.language, false);
  }

  function validateForm() {
    const surname = state.form.surname.trim();
    const firstName = state.form.firstName.trim();
    const phone = state.form.phone.trim();
    const surnameError = $("#surname-error");
    const firstNameError = $("#first-name-error");
    const phoneError = $("#phone-error");
    const consentError = $("#consent-error");
    if (surnameError) surnameError.textContent = "";
    if (firstNameError) firstNameError.textContent = "";
    if (phoneError) phoneError.textContent = "";
    if (consentError) consentError.textContent = "";
    if (!surname) { if (surnameError) surnameError.textContent = t("validation_surname"); $("#lead-surname").focus(); return false; }
    if (!firstName) { if (firstNameError) firstNameError.textContent = t("validation_first_name"); $("#lead-first-name").focus(); return false; }
    const digits = phone.replace(/\D/g, "");
    const validPhone = /^[+]?[0-9][0-9\s().-]*$/.test(phone) && digits.length >= 7 && digits.length <= 15;
    const phoneField = $("#lead-phone");
    if (!validPhone) {
      if (phoneError) phoneError.textContent = phone ? t("validation_phone") : t("validation_contact");
      if (phoneField) { phoneField.setAttribute("aria-invalid", "true"); phoneField.focus(); }
      return false;
    }
    if (phoneField) phoneField.removeAttribute("aria-invalid");
    if (!state.form.consent) {
      if (consentError) consentError.textContent = t("validation_consent");
      const consent = $("#lead-consent");
      if (consent) consent.focus();
      return false;
    }
    return true;
  }

  function collectUtm() {
    const params = new URLSearchParams(window.location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const values = {};
    keys.forEach((key) => { if (params.has(key)) values[key] = params.get(key); });
    return values;
  }

  async function submitLead(event) {
    event.preventDefault();
    if (state.submitting || !validateForm()) return;
    if (config.demoMode || !config.apiUrl) {
      setStatus("demo", t("demo_message"), false);
      return;
    }
    const payload = {
      plot: state.answers.plot,
      purpose: state.answers.purpose,
      lease_term: state.answers.term,
      visit_preference: state.answers.visit || "",
      surname: state.form.surname.trim(),
      first_name: state.form.firstName.trim(),
      name: state.form.firstName.trim() + " " + state.form.surname.trim(),
      contact_method: "phone",
      phone: state.form.phone.trim(),
      contact: state.form.phone.trim(),
      comment: "",
      language: state.language,
      consent: state.form.consent,
      privacy_policy_url: config.privacyUrl || "",
      utm: collectUtm()
    };
    state.submitting = true;
    const button = $('#lead-form button[type="submit"]');
    if (button) button.disabled = true;
    const label = $("#submit-label");
    if (label) label.textContent = t("submit_loading");
    setStatus("sending", t("submit_loading"), false);
    try {
      const response = await fetch(config.apiUrl, {
        method: "POST", mode: "cors", credentials: "omit",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      let result = null;
      try { result = await response.json(); } catch (_) { result = null; }
      const successField = config.apiSuccessField || "success";
      if (!response.ok || !result || result[successField] !== true) throw new Error("not-confirmed");
      state.submitting = false;
      if (leadDialogContent) leadDialogContent.innerHTML = successMarkup();
      leadDialog.setAttribute("aria-label", t("success_title"));
      const successHeading = $("#dialog-success-title");
      if (successHeading) successHeading.focus({ preventScroll: true });
    } catch (_) {
      state.submitting = false;
      if (button) button.disabled = false;
      if (label) label.textContent = t("form_submit");
      setStatus("error", t("submit_error"), false);
    }
  }

  function openContactDialog() {
    if (!leadDialog) return;
    if (!leadDialog.open && typeof leadDialog.showModal === "function") leadDialog.showModal();
    const surname = $("#lead-surname");
    if (surname) surname.focus({ preventScroll: true });
  }

  function applyConfig() {
    const rep = config.representative || {};
    if (rep.phone) {
      $$(".header-phone, .contact-links .contact-detail[href^='tel'], .quiz-contact-inline a, .footer-contact[href^='tel']").forEach((link) => {
        link.href = rep.phoneHref || "tel:" + rep.phone.replace(/\D/g, "");
        const text = $("span", link);
        if (text) text.textContent = rep.phone;
      });
    }
    if (rep.email) {
      $$(".contact-links .contact-detail[href^='mailto'], .footer-contact[href^='mailto']").forEach((link) => {
        link.href = "mailto:" + rep.email;
        const text = $("span", link);
        if (text) text.textContent = rep.email;
      });
    }
    const policyLink = $("#privacy-link-form");
    if (policyLink && config.privacyUrl) policyLink.href = config.privacyUrl;
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    const languageButton = target.closest("[data-language]");
    if (languageButton) {
      setLanguage(languageButton.dataset.language, true);
      return;
    }
    const actionButton = target.closest("[data-action]");
    if (actionButton) {
      const action = actionButton.dataset.action;
      if (action === "back") goBack();
      else if (action === "continue") continueForward();
      else if (action === "skip") { state.answers.visit = ""; showStep("result"); }
      else if (action === "to-contact") openContactDialog();
      else if (action === "close-contact") { if (leadDialog && leadDialog.open) leadDialog.close(); }
      else if (action === "zoom-scheme") {
        const image = $("#scheme-dialog-image");
        if (schemeDialog && image) {
          image.src = actionButton.dataset.schemeSrc || "";
          image.alt = actionButton.dataset.schemeAlt || "";
          if (!schemeDialog.open && typeof schemeDialog.showModal === "function") schemeDialog.showModal();
        }
      }
      else if (action === "close-scheme") { if (schemeDialog && schemeDialog.open) schemeDialog.close(); }
      else if (action === "restart") restart();
      return;
    }
  });

  const stepContainer = $("#step-container");
  stepContainer.addEventListener("change", (event) => {
    const input = event.target;
    if (!input.matches(".choice-input")) return;
    const group = input.name;
    state.answers[group] = input.value;
    $$('input[name="' + group + '"]', stepContainer).forEach((radio) => {
      const label = radio.closest("label");
      if (label) label.classList.toggle("is-selected", radio.checked);
    });
    const continueButton = $('[data-action="continue"]', stepContainer);
    if (continueButton) continueButton.disabled = !state.answers[group];
  });

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (input.name === "surname") { state.form.surname = input.value; const error = $("#surname-error"); if (error) error.textContent = ""; input.removeAttribute("aria-invalid"); }
    if (input.name === "firstName") { state.form.firstName = input.value; const error = $("#first-name-error"); if (error) error.textContent = ""; input.removeAttribute("aria-invalid"); }
    if (input.name === "phone") {
      state.form.phone = input.value;
      const error = $("#phone-error");
      if (error) error.textContent = "";
      input.removeAttribute("aria-invalid");
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target && event.target.name === "consent") {
      state.form.consent = event.target.checked;
      const error = $("#consent-error");
      if (error && event.target.checked) error.textContent = "";
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target && event.target.id === "lead-form") submitLead(event);
  });

  if (leadDialog) {
    leadDialog.addEventListener("click", (event) => {
      if (event.target === leadDialog) leadDialog.close();
    });
  }

  if (schemeDialog) {
    schemeDialog.addEventListener("click", (event) => {
      if (event.target === schemeDialog) schemeDialog.close();
    });
  }

  applyConfig();
  setLanguage("ru", false);
})();

