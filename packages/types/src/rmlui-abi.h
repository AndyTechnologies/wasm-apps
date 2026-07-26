#ifndef RMLUI_ABI_H
#define RMLUI_ABI_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ── Opaque handles ───────────────────────────────────────────────────── */

typedef int32_t Rml_ContextId;
typedef int32_t Rml_ElementId;
typedef int32_t Rml_DocumentId;
typedef int32_t Rml_CallbackId;

/* ── Error codes ──────────────────────────────────────────────────────── */

typedef enum {
  RMLUI_OK                =  0,
  RMLUI_ERR_INVALID_HANDLE = -1,
  RMLUI_ERR_NULL_PARAM    = -2,
  RMLUI_ERR_OUT_OF_MEMORY = -3,
  RMLUI_ERR_UNSUPPORTED   = -4,
  RMLUI_ERR_INTERNAL      = -5,
} Rml_Error;

/* ── Context lifecycle ────────────────────────────────────────────────── */

Rml_ContextId Rml_CreateContext(const char* name, int w, int h);
void          Rml_ReleaseContext(Rml_ContextId ctx);

/* ── Document loading ─────────────────────────────────────────────────── */

Rml_DocumentId Rml_LoadDocument(Rml_ContextId ctx, const char* path);
Rml_DocumentId Rml_LoadDocumentFromString(Rml_ContextId ctx, const char* rml);
Rml_DocumentId Rml_LoadDocumentFromBuffer(Rml_ContextId ctx, const void* data, int32_t len);
void           Rml_ShowDocument(Rml_DocumentId doc);
void           Rml_HideDocument(Rml_DocumentId doc);
void           Rml_CloseDocument(Rml_DocumentId doc);

/* ── Element tree construction ────────────────────────────────────────── */

Rml_ElementId Rml_CreateElement(const char* tag);
Rml_ElementId Rml_CreateTextNode(const char* text);
int32_t       Rml_AppendChild(Rml_ElementId parent, Rml_ElementId child);
int32_t       Rml_RemoveChild(Rml_ElementId parent, Rml_ElementId child);
int32_t       Rml_InsertBefore(Rml_ElementId parent, Rml_ElementId child, Rml_ElementId ref);
int32_t       Rml_ReplaceChild(Rml_ElementId parent, Rml_ElementId newChild, Rml_ElementId oldChild);

/* ── Attributes and content ───────────────────────────────────────────── */

int32_t       Rml_SetAttribute(Rml_ElementId el, const char* name, const char* value);
const char*   Rml_GetAttribute(Rml_ElementId el, const char* name);
int32_t       Rml_RemoveAttribute(Rml_ElementId el, const char* name);
int32_t       Rml_HasAttribute(Rml_ElementId el, const char* name);
int32_t       Rml_SetTextContent(Rml_ElementId el, const char* text);
const char*   Rml_GetTextContent(Rml_ElementId el);
int32_t       Rml_SetInnerHTML(Rml_ElementId el, const char* html);
const char*   Rml_GetInnerHTML(Rml_ElementId el);

/* ── Style properties ─────────────────────────────────────────────────── */

int32_t       Rml_SetStyleProperty(Rml_ElementId el, const char* prop, const char* value);
const char*   Rml_GetStyleProperty(Rml_ElementId el, const char* prop);
int32_t       Rml_SetStyle(Rml_ElementId el, const char* css_text);

/* ── Event system ─────────────────────────────────────────────────────── */

int32_t Rml_AddEventListener(Rml_ElementId el, const char* event, Rml_CallbackId cb_id);
int32_t Rml_RemoveEventListener(Rml_ElementId el, const char* event);

/* Event object populated during callback dispatch. Valid only inside the callback. */
typedef struct {
  const char* type;
  int32_t     target_id;
  int32_t     mouse_screen_x;
  int32_t     mouse_screen_y;
  int32_t     key_code;
  int32_t     key_modifiers;
  int32_t     prevent_default;   /* set to 1 to prevent default action */
  int32_t     stop_propagation;  /* set to 1 to stop event bubbling */
  /* Reserved for touch/gesture future use */
  int32_t     _reserved[4];
} Rml_Event;

/* Get the current event being dispatched. Returns NULL outside a callback. */
const Rml_Event* Rml_GetCurrentEvent(void);

/* ── Class list ────────────────────────────────────────────────────────── */

int32_t Rml_AddClass(Rml_ElementId el, const char* cls);
int32_t Rml_RemoveClass(Rml_ElementId el, const char* cls);
int32_t Rml_ToggleClass(Rml_ElementId el, const char* cls);
int32_t Rml_HasClass(Rml_ElementId el, const char* cls);

/* ── Font loading ──────────────────────────────────────────────────────── */

int32_t Rml_LoadFont(const char* path);
int32_t Rml_LoadFontFromBuffer(const char* name, const void* data, int32_t len);

/* ── Texture loading ───────────────────────────────────────────────────── */

int32_t Rml_LoadTexture(const char* path);
int32_t Rml_LoadTextureFromBuffer(const char* name, const void* data, int32_t len);

/* Texture dimensions. Returns 0 on success, fills w/h pointers. */
int32_t Rml_GetTextureDimensions(const char* name, int32_t* w, int32_t* h);

/* ── Render loop (called from main.cpp generated template) ──────────────── */

void    RmlUI_ProcessSdlEvents(void);
void    RmlUI_Update(void);
void    RmlUI_Render(void);
void    RmlUI_Shutdown(void);
int32_t RmlUI_IsRunning(void);

/* ── Query selectors ────────────────────────────────────────────────────── */

Rml_ElementId Rml_GetElementById(Rml_ContextId ctx, const char* id);
Rml_ElementId Rml_QuerySelector(Rml_ElementId el, const char* selector);
/* Returns a pointer to a static array of element IDs (null-terminated, last entry = 0). */
const int32_t* Rml_QuerySelectorAll(Rml_ElementId el, const char* selector);
void            Rml_FreeNodeList(const int32_t* elements);

/* ── Document body/head access ──────────────────────────────────────────── */

Rml_ElementId Rml_GetBody(Rml_ContextId ctx);
Rml_ElementId Rml_GetHead(Rml_ContextId ctx);

/* ── Resource path ───────────────────────────────────────────────────────── */

/** Set the search path list (semicolon-separated) for RmlUI file interface. */
int32_t Rml_SetResourcePath(Rml_ContextId ctx, const char* path_list);

/* ── Custom Resource Provider ─────────────────────────────────────────────── */

/** Callback types for a custom resource provider. All return 0 on success. */
typedef int32_t (*Rml_ResourceOpen)(const char* path, int32_t* out_size);
typedef int32_t (*Rml_ResourceRead)(const char* path, void* buffer, int32_t max_len);
typedef void    (*Rml_ResourceClose)(const char* path);

typedef struct {
  const char*         name;
  Rml_ResourceOpen    open_fn;
  Rml_ResourceRead    read_fn;
  Rml_ResourceClose   close_fn;
} Rml_ResourceProvider;

int32_t Rml_RegisterResourceProvider(Rml_ContextId ctx, const Rml_ResourceProvider* provider);

/* ── Debugger ───────────────────────────────────────────────────────────── */

void Rml_DebuggerToggle(void);

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* RMLUI_ABI_H */
