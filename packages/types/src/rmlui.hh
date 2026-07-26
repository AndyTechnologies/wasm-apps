#pragma once

#include "rmlui-abi.h"

#include <stdexcept>
#include <string>
#include <functional>
#include <unordered_map>

// ── Exception class ──────────────────────────────────────────────────────

class RmlUI_Exception : public std::runtime_error {
  Rml_Error code_;
public:
  explicit RmlUI_Exception(Rml_Error err)
    : std::runtime_error(_errorMessage(err)), code_(err) {}

  Rml_Error error_code() const noexcept { return code_; }

private:
  static const char* _errorMessage(Rml_Error err) {
    switch (err) {
      case RMLUI_ERR_INVALID_HANDLE: return "RmlUI: invalid handle";
      case RMLUI_ERR_NULL_PARAM:     return "RmlUI: null parameter";
      case RMLUI_ERR_OUT_OF_MEMORY:  return "RmlUI: out of memory";
      case RMLUI_ERR_UNSUPPORTED:    return "RmlUI: unsupported operation";
      case RMLUI_ERR_INTERNAL:       return "RmlUI: internal error";
      default:                       return "RmlUI: unknown error";
    }
  }
};

// ── Forward declarations ─────────────────────────────────────────────────

class RmlContext;
class RmlElement;

// ── Typedef alias ────────────────────────────────────────────────────────

using RmlDocument = RmlElement;

// ── RmlContext ───────────────────────────────────────────────────────────

class RmlContext {
  Rml_ContextId id_;

public:
  RmlContext(const char* name, int w, int h)
    : id_(Rml_CreateContext(name, w, h)) {}

  ~RmlContext() {
    if (id_ != 0) Rml_ReleaseContext(id_);
  }

  RmlContext(const RmlContext&) = delete;
  RmlContext& operator=(const RmlContext&) = delete;

  RmlContext(RmlContext&& other) noexcept : id_(other.id_) {
    other.id_ = 0;
  }

  RmlContext& operator=(RmlContext&& other) noexcept {
    if (this != &other) {
      if (id_ != 0) Rml_ReleaseContext(id_);
      id_ = other.id_;
      other.id_ = 0;
    }
    return *this;
  }

  Rml_ContextId native_handle() const noexcept { return id_; }

  RmlElement document(const char* path);
  RmlElement body();
  RmlElement head();
  RmlElement getElementById(const char* id);
};

// ── RmlElement ───────────────────────────────────────────────────────────

class RmlElement {
  Rml_ElementId id_;

public:
  using Callback = std::function<void()>;

  RmlElement() : id_(0) {}
  explicit RmlElement(Rml_ElementId id) : id_(id) {}

  Rml_ElementId native_handle() const noexcept { return id_; }
  bool valid() const noexcept { return id_ != 0; }

  // ── DOM tree ─────────────────────────────────────────────────────────

  void appendChild(RmlElement child) {
    int32_t rc = Rml_AppendChild(id_, child.id_);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  void removeChild(RmlElement child) {
    int32_t rc = Rml_RemoveChild(id_, child.id_);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  void insertBefore(RmlElement child, RmlElement ref) {
    int32_t rc = Rml_InsertBefore(id_, child.id_, ref.id_);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  void replaceChild(RmlElement newChild, RmlElement oldChild) {
    int32_t rc = Rml_ReplaceChild(id_, newChild.id_, oldChild.id_);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  // ── Attributes ───────────────────────────────────────────────────────

  void setAttribute(const char* name, const char* value) {
    int32_t rc = Rml_SetAttribute(id_, name, value);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  std::string getAttribute(const char* name) {
    const char* val = Rml_GetAttribute(id_, name);
    return val ? std::string(val) : std::string();
  }

  void removeAttribute(const char* name) {
    int32_t rc = Rml_RemoveAttribute(id_, name);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  bool hasAttribute(const char* name) {
    return Rml_HasAttribute(id_, name) != 0;
  }

  // ── Content ──────────────────────────────────────────────────────────

  void setTextContent(const char* text) {
    int32_t rc = Rml_SetTextContent(id_, text);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  std::string getTextContent() {
    const char* val = Rml_GetTextContent(id_);
    return val ? std::string(val) : std::string();
  }

  void setInnerHTML(const char* html) {
    int32_t rc = Rml_SetInnerHTML(id_, html);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  std::string getInnerHTML() {
    const char* val = Rml_GetInnerHTML(id_);
    return val ? std::string(val) : std::string();
  }

  // ── Style ────────────────────────────────────────────────────────────

  void setStyleProperty(const char* prop, const char* value) {
    int32_t rc = Rml_SetStyleProperty(id_, prop, value);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  std::string getStyleProperty(const char* prop) {
    const char* val = Rml_GetStyleProperty(id_, prop);
    return val ? std::string(val) : std::string();
  }

  void setStyle(const char* css) {
    int32_t rc = Rml_SetStyle(id_, css);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  // ── Events ───────────────────────────────────────────────────────────

  void addEventListener(const char* event, Callback cb);
  void removeEventListener(const char* event);

  // ── Class list ───────────────────────────────────────────────────────

  void addClass(const char* cls) {
    int32_t rc = Rml_AddClass(id_, cls);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  void removeClass(const char* cls) {
    int32_t rc = Rml_RemoveClass(id_, cls);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  void toggleClass(const char* cls) {
    int32_t rc = Rml_ToggleClass(id_, cls);
    if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }

  bool hasClass(const char* cls) {
    return Rml_HasClass(id_, cls) != 0;
  }
};

// ── Free functions ───────────────────────────────────────────────────────

inline RmlDocument loadDocument(Rml_ContextId ctx, const char* path) {
  return RmlElement(Rml_LoadDocument(ctx, path));
}

inline void showDocument(RmlDocument doc) {
  Rml_ShowDocument(doc.native_handle());
}

inline void processEvents() {
  RmlUI_ProcessSdlEvents();
}

inline void update() {
  RmlUI_Update();
}

inline void render() {
  RmlUI_Render();
}

inline void shutdown() {
  RmlUI_Shutdown();
}

// ── Inline member implementations (require full class definition) ─────────

inline RmlElement RmlContext::document(const char* path) {
  return RmlElement(Rml_LoadDocument(id_, path));
}

inline RmlElement RmlContext::body() {
  return RmlElement(Rml_GetBody(id_));
}

inline RmlElement RmlContext::head() {
  return RmlElement(Rml_GetHead(id_));
}

inline RmlElement RmlContext::getElementById(const char* id) {
  return RmlElement(Rml_GetElementById(id_, id));
}

// ── Callback registry (static, shared across all RmlElement instances) ──

namespace _rmlui_internal {

using CallbackMap = std::unordered_map<Rml_CallbackId, RmlElement::Callback>;

inline CallbackMap& getCallbackMap() {
  static CallbackMap map;
  return map;
}

inline Rml_CallbackId registerCallback(RmlElement::Callback cb) {
  static Rml_CallbackId nextId = 1;
  Rml_CallbackId id = nextId++;
  getCallbackMap()[id] = std::move(cb);
  return id;
}

inline void unregisterCallback(Rml_CallbackId id) {
  getCallbackMap().erase(id);
}

// Dispatch function: called by the bridge when an event fires.
// The bridge provides the callback ID; this looks up and invokes the
// corresponding std::function.
inline void dispatchCallback(Rml_CallbackId id) {
  auto& map = getCallbackMap();
  auto it = map.find(id);
  if (it != map.end()) {
    it->second();
  }
}

} // namespace _rmlui_internal

inline void RmlElement::addEventListener(const char* event, Callback cb) {
  Rml_CallbackId cbId = _rmlui_internal::registerCallback(std::move(cb));
  int32_t rc = Rml_AddEventListener(id_, event, cbId);
  if (rc != RMLUI_OK) {
    _rmlui_internal::unregisterCallback(cbId);
    throw RmlUI_Exception(static_cast<Rml_Error>(rc));
  }
}

inline void RmlElement::removeEventListener(const char* event) {
  int32_t rc = Rml_RemoveEventListener(id_, event);
  if (rc != RMLUI_OK) throw RmlUI_Exception(static_cast<Rml_Error>(rc));
}
