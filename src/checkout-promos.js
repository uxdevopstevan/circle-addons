import cfg from '@circle-config/checkout-promos';

export function initCheckoutPromos() {
  const promos = (cfg && Array.isArray(cfg.promos)) ? cfg.promos : [];
  if (promos.length === 0) return;

  const path = window.location.pathname || '';
  const promo = promos.find(p => p && p.enabled !== false && p.match && typeof p.match.pathIncludes === 'string' && path.includes(p.match.pathIncludes));
  if (!promo) return;

  const INPUT_SELECTOR = 'input[name="coupon_code"]';
  const BUTTON_SELECTOR = '[data-testid="checkout-form-apply-coupon"]';
  const COUPON_CODE = promo.coupon && promo.coupon.code;
  if (!COUPON_CODE) return;

  const containerId = (promo.ui && promo.ui.containerId) || 'circle-promo-question';
  const questionText = (promo.ui && promo.ui.questionText) || 'Are you eligible for a discount?';
  const yesText = (promo.ui && promo.ui.yesText) || 'Yes';
  const noText = (promo.ui && promo.ui.noText) || 'No';
  const defaultAnswer = (promo.ui && promo.ui.defaultAnswer) || 'no';

  const createQuestion = (couponInput) => {
    if (document.getElementById(containerId)) return;

    const container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'margin-bottom: 20px; padding: 15px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;';

    const label = document.createElement('div');
    label.textContent = questionText;
    label.style.cssText = 'font-weight: 600; margin-bottom: 10px; color: #0c4a6e;';

    const radioContainer = document.createElement('div');
    radioContainer.style.cssText = 'display: flex; gap: 20px; align-items: center;';

    const yesLabel = document.createElement('label');
    yesLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';
    const yesRadio = document.createElement('input');
    yesRadio.type = 'radio';
    yesRadio.name = containerId + '-answer';
    yesRadio.value = 'yes';
    yesRadio.style.cssText = 'cursor: pointer;';
    const yesSpan = document.createElement('span');
    yesSpan.textContent = yesText;
    yesLabel.appendChild(yesRadio);
    yesLabel.appendChild(yesSpan);

    const noLabel = document.createElement('label');
    noLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';
    const noRadio = document.createElement('input');
    noRadio.type = 'radio';
    noRadio.name = containerId + '-answer';
    noRadio.value = 'no';
    noRadio.style.cssText = 'cursor: pointer;';
    const noSpan = document.createElement('span');
    noSpan.textContent = noText;
    noLabel.appendChild(noRadio);
    noLabel.appendChild(noSpan);

    if (defaultAnswer === 'yes') yesRadio.checked = true;
    else noRadio.checked = true;

    radioContainer.appendChild(yesLabel);
    radioContainer.appendChild(noLabel);

    container.appendChild(label);
    container.appendChild(radioContainer);

    const couponWrapper = couponInput.parentNode;
    const wrapperParent = couponWrapper && couponWrapper.parentNode;
    if (wrapperParent && wrapperParent.insertBefore) wrapperParent.insertBefore(container, couponWrapper);
    else if (couponWrapper && couponWrapper.insertBefore) couponWrapper.insertBefore(container, couponWrapper.firstChild);
    else document.body.insertBefore(container, document.body.firstChild);

    yesRadio.addEventListener('change', function() {
      if (this.checked) applyCoupon(couponInput);
    });
  };

  const applyCoupon = (couponInputField) => {
    let reactPropsKey = Object.keys(couponInputField).find(key => key.startsWith('__reactProps$'));
    if (!reactPropsKey) return;

    const reactProps = couponInputField[reactPropsKey];
    const changeHandler = reactProps && reactProps.onChange;
    if (!changeHandler) return;

    couponInputField.value = COUPON_CODE;
    changeHandler({
      target: couponInputField,
      currentTarget: couponInputField,
      type: 'change',
      bubbles: true,
      persist: () => {}
    });

    let attempts = 0;
    const MAX_WAIT_MS = 3000;
    const CHECK_INTERVAL_MS = 100;

    const pollInterval = setInterval(() => {
      const applyButton = document.querySelector(BUTTON_SELECTOR);
      if (applyButton) {
        applyButton.click();
        clearInterval(pollInterval);
        return;
      }
      attempts++;
      if (attempts * CHECK_INTERVAL_MS >= MAX_WAIT_MS) clearInterval(pollInterval);
    }, CHECK_INTERVAL_MS);
  };

  const initialize = () => {
    const couponInputField = document.querySelector(INPUT_SELECTOR);
    if (!couponInputField) return false;
    createQuestion(couponInputField);
    return true;
  };

  if (initialize()) return;

  const observer = new MutationObserver((mutations, obs) => {
    if (initialize()) obs.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
}

