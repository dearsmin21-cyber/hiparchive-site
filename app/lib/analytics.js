function sanitizeParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  );
}

function sendGtag(eventName, params) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, sanitizeParams(params));
}

function sendFbTrack(eventName, params) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("track", eventName, sanitizeParams(params));
}

function sendFbCustom(eventName, params) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("trackCustom", eventName, sanitizeParams(params));
}

function packageValue(packageItem) {
  if (!packageItem?.price) {
    return undefined;
  }

  const parsed = Number(packageItem.price.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function trackEvent(eventName, params = {}) {
  const cleanParams = sanitizeParams(params);
  sendGtag(eventName, cleanParams);
  sendFbCustom(eventName, cleanParams);
}

export function trackInquiryClick(location) {
  sendGtag("click_inquiry", { location });
  sendGtag("generate_lead", { location, method: "kakao_channel" });
  sendFbTrack("Contact", { content_name: "Kakao Inquiry", location });
}

export function trackPurchaseClick(packageItem, location) {
  const value = packageValue(packageItem);
  const params = {
    currency: "KRW",
    value,
    location,
    items: [
      {
        item_id: packageItem.id,
        item_name: packageItem.name,
        price: value,
      },
    ],
  };

  sendGtag("click_purchase", {
    package_id: packageItem.id,
    package_name: packageItem.name,
    location,
    value,
  });
  sendGtag("begin_checkout", params);
  sendFbTrack("InitiateCheckout", {
    currency: "KRW",
    value,
    content_ids: [packageItem.id],
    content_name: packageItem.name,
    location,
  });
}

export function trackPackageSelection(packageItem, source) {
  const value = packageValue(packageItem);

  sendGtag("select_item", {
    item_list_name: source,
    items: [
      {
        item_id: packageItem.id,
        item_name: packageItem.name,
        price: value,
      },
    ],
  });
  trackEvent("select_package", {
    package_id: packageItem.id,
    package_name: packageItem.name,
    source,
    value,
  });
}

export function trackPlanPickerOpen(packageItem) {
  trackEvent("open_plan_picker", {
    package_id: packageItem?.id,
    package_name: packageItem?.name,
  });
}

export function trackNavClick(label) {
  sendGtag("select_content", {
    content_type: "navigation",
    item_id: label,
  });
  trackEvent("click_nav", { label });
}
