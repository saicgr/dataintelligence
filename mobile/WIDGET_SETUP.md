# Home / Lock-Screen Widget + Live Activity — Setup Guide (plan #18)

ByteShards is a **managed Expo app (SDK 56)**. A native iOS widget cannot be
built or run in Expo Go — it requires a Swift WidgetKit target compiled into a
**custom dev/prod build via EAS**. This guide is the precise, current recipe to
add that target. The JS half (`src/lib/widget.ts`) already exists and no-ops
gracefully until the native side below is wired.

> Verified against the Expo **v56.0.0** versioned docs (https://docs.expo.dev/versions/v56.0.0/).
> Expo SDK 56 ships **no first-party `expo-widgets` package** — widgets are added
> via a community config plugin + a native target. Two viable libraries exist;
> see "Choosing the library" below.

---

## 0. What we're building

| Surface | Tech | iOS min |
| --- | --- | --- |
| Home + lock-screen **widget** (streak, due count, card of the day, interview countdown) | **WidgetKit** + SwiftUI, timeline fed from an **App Group `UserDefaults`** the app writes | iOS 16+ (lock-screen widgets 16.0; we target 16.2 to share with Live Activities) |
| **Live Activity** (daily-session ring on lock screen / Dynamic Island) | **ActivityKit** + SwiftUI | iOS 16.2 |

Data direction: **app → widget** only (the widget never writes back). The app
writes a JSON snapshot into the shared App Group container; the WidgetKit
timeline provider reads it and `WidgetCenter.reloadAllTimelines()` refreshes the
face. Live Activities are driven imperatively via the ActivityKit JS bridge.

---

## 1. Choosing the library (current options, SDK 56)

There are two maintained approaches. **They solve different halves**, and the
cleanest setup uses **both**:

### A. `@bacons/apple-targets` — for the WidgetKit home/lock-screen widget (PRIMARY)
- Config plugin that generates **any** Apple target (widget, App Clip, ActivityKit
  extension) during `expo prebuild`, kept outside `/ios` via Continuous Native
  Generation. Requires **Expo SDK 53+**, Xcode 16, CocoaPods 1.16.2.
- You author real Swift in `targets/widget/`; the plugin wires the target,
  frameworks (SwiftUI / WidgetKit / ActivityKit), and **App Group entitlements**
  (auto-mirrored to the main app).
- This is how the **home/lock-screen widget timeline** gets built. There is no
  npm JS API for the widget timeline — the app shares data via App Group
  `UserDefaults` (see §4), and we expose that to JS through a tiny native module
  or an existing shared-defaults bridge.

### B. `react-native-widget-extension` — for the Live Activity JS API (OPTIONAL)
- Provides exactly the ActivityKit JS surface `src/lib/widget.ts` probes for:
  `areActivitiesEnabled()`, `startActivity()`, `updateActivity()`, `endActivity()`.
- **It does NOT provide a home-screen-widget timeline / `setWidgetData` /
  `reloadAllTimelines` JS API** — it is Live-Activity-focused. So it complements,
  not replaces, the widget target.
- Plugin config keys: `frequentUpdates`, `widgetsFolder` (Swift folder path),
  `deploymentTarget` (default `"16.2"`), `groupIdentifier` (must start with
  `group.`), `keychainAccessGroup`.

**Recommendation:**
- **Widget only (ship first):** use `@bacons/apple-targets` + a 1-file native
  module that writes the App Group `UserDefaults` and calls
  `WidgetCenter.reloadAllTimelines()`. Expose it as a module named
  `react-native-widget-extension` shape **or** rename the probe in `widget.ts`.
- **Widget + Live Activity:** add `react-native-widget-extension` for the
  ActivityKit JS API (its method names already match `widget.ts`), and keep
  `@bacons/apple-targets` (or the same lib's `widgetsFolder`) for the WidgetKit
  target.

`widget.ts` is written so that **whichever** of these is linked, the matching
calls light up and the rest stay no-ops. The module name it `require`s is
`'react-native-widget-extension'`; if you go pure-apple-targets, either publish
your native module under that name or change the one `require()` line.

---

## 2. App config — `app.json` additions

### 2a. Add the plugin(s) to `expo.plugins`

If using **both** libraries:

```jsonc
"plugins": [
  "expo-router",
  // …existing entries…
  "expo-notifications",
  "expo-audio",

  // PRIMARY: generates the WidgetKit (+ optional ActivityKit) Apple target
  [
    "@bacons/apple-targets",
    { "appleTeamId": "YOUR_TEAM_ID" }
  ],

  // OPTIONAL: ActivityKit JS bridge (Live Activities). Swift lives in ./widgets
  [
    "react-native-widget-extension",
    {
      "frequentUpdates": true,
      "widgetsFolder": "widgets",
      "deploymentTarget": "16.2",
      "groupIdentifier": "group.com.byteshards.app",
      "keychainAccessGroup": "YOUR_TEAM_ID.com.byteshards.app"
    }
  ]
]
```

> If you ship the **widget only**, drop the `react-native-widget-extension` entry
> and keep just `@bacons/apple-targets`.

### 2b. Add the App Group entitlement to the **main app** (iOS)

The main app and the widget must be in the **same App Group** to share data.
With `@bacons/apple-targets` the group is mirrored to the main app automatically,
but declare it explicitly so EAS provisioning picks it up:

```jsonc
"ios": {
  "icon": "./assets/expo.icon",
  "bundleIdentifier": "com.byteshards.app",
  "entitlements": {
    "com.apple.security.application-groups": ["group.com.byteshards.app"]
  },
  "infoPlist": {
    // required only if the Live Activity does frequent server/local updates
    "NSSupportsLiveActivities": true,
    "NSSupportsLiveActivitiesFrequentUpdates": true
  }
}
```

> Use a single canonical App Group id everywhere: **`group.com.byteshards.app`**.
> It must match in: main-app entitlements, the widget target entitlements, the
> `groupIdentifier` plugin option, and the Swift `UserDefaults(suiteName:)` call.

---

## 3. The Apple target — folder + Swift outline

With `@bacons/apple-targets`, create `targets/widget/` (the directory name is the
target name). Files:

### `targets/widget/expo-target.config.js`
```js
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'ByteShardsWidget',
  // SwiftUI for the views, WidgetKit for the home/lock widget,
  // ActivityKit only if this target also hosts the Live Activity.
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.byteshards.app'],
  },
  deploymentTarget: '16.2',
};
```

### `targets/widget/ByteShardsWidget.swift` (outline)
```swift
import WidgetKit
import SwiftUI

private let appGroup = "group.com.byteshards.app"
private let dataKey  = "fieldnotes.widget.data"   // matches the JS writer (§4)

// Mirror of WidgetData in src/lib/widget.ts (keep field names in sync).
struct WidgetData: Codable {
  var streak: Int
  var dueCount: Int
  var cardOfTheDay: CardOfTheDay?
  var interviewDaysLeft: Int?
  var goal: Int
  var cardsToday: Int
  var updatedAt: Double
  struct CardOfTheDay: Codable { var id: String; var tool: String; var q: String }
}

struct Entry: TimelineEntry { let date: Date; let data: WidgetData? }

struct Provider: TimelineProvider {
  func placeholder(in: Context) -> Entry { Entry(date: .now, data: nil) }
  func getSnapshot(in: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: .now, data: read()))
  }
  func getTimeline(in: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    // Refresh roughly hourly; the app also calls reloadAllTimelines() on change.
    let next = Calendar.current.date(byAdding: .hour, value: 1, to: .now)!
    completion(Timeline(entries: [Entry(date: .now, data: read())], policy: .after(next)))
  }
  private func read() -> WidgetData? {
    guard let d = UserDefaults(suiteName: appGroup)?.data(forKey: dataKey) else { return nil }
    return try? JSONDecoder().decode(WidgetData.self, from: d)
  }
}

struct ByteShardsWidgetView: View {
  let entry: Entry
  var body: some View {
    let d = entry.data
    VStack(alignment: .leading, spacing: 4) {
      HStack { Text("🔥 \(d?.streak ?? 0)").bold(); Spacer()
               Text("\(d?.dueCount ?? 0) due").foregroundStyle(.secondary) }
      if let c = d?.cardOfTheDay {
        Text(c.tool).font(.caption2).foregroundStyle(.secondary)
        Text(c.q).font(.footnote).lineLimit(3)
      }
      if let n = d?.interviewDaysLeft { Text("Interview in \(n)d").font(.caption2) }
    }
    .padding()
    .widgetURL(URL(string: "mobile://daily"))   // deep-links into the app (scheme: "mobile")
  }
}

@main
struct ByteShardsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ByteShardsWidget", provider: Provider()) { e in
      ByteShardsWidgetView(entry: e)
    }
    .configurationDisplayName("ByteShards")
    .description("Your streak, due reviews, and card of the day.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}
```

### `targets/widget/ByteShardsActivity.swift` (only if hosting the Live Activity here)
```swift
import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.2, *)
struct DailySessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var goal: Int; var cardsToday: Int; var streak: Int; var dueCount: Int
  }
  var kind: String   // "daily-session" (matches startSessionLiveActivity in widget.ts)
}

@available(iOS 16.2, *)
struct DailySessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DailySessionAttributes.self) { ctx in
      // Lock-screen banner
      HStack {
        Text("🔥 \(ctx.state.streak)")
        Spacer()
        Text("\(ctx.state.cardsToday)/\(ctx.state.goal)")
      }.padding()
    } dynamicIsland: { ctx in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Text("🔥 \(ctx.state.streak)") }
        DynamicIslandExpandedRegion(.trailing) { Text("\(ctx.state.cardsToday)/\(ctx.state.goal)") }
      } compactLeading: { Text("🔥") }
        compactTrailing: { Text("\(ctx.state.cardsToday)/\(ctx.state.goal)") }
        minimal: { Text("\(ctx.state.cardsToday)") }
    }
  }
}
```

> If you adopt `react-native-widget-extension` for Live Activities, put its
> `ActivityAttributes` + view in the `widgetsFolder` it points at (`./widgets`),
> and keep the **WidgetKit home widget** under `@bacons/apple-targets`. The two
> can coexist or be merged into one target — just keep one `@main` per target.

---

## 4. Sharing data app → widget (the JS `pushWidgetUpdate` bridge)

`react-native-widget-extension` does **not** expose `setWidgetData` /
`reloadAllTimelines`. For the home-widget timeline you need a tiny native module
(or a shared-defaults package such as `@react-native-async-storage` is **not**
App-Group aware — do not use it for the widget). Minimal native module:

```swift
// ios/.../WidgetData.swift  (registered as RN module "react-native-widget-extension"
// OR rename the require() in src/lib/widget.ts to your module name)
import Foundation
import WidgetKit

@objc(WidgetData)
class WidgetData: NSObject {
  @objc func setWidgetData(_ json: String) {
    UserDefaults(suiteName: "group.com.byteshards.app")?
      .set(json.data(using: .utf8), forKey: "fieldnotes.widget.data")
  }
  @objc func reloadAllTimelines() {
    if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
  }
  @objc static func requiresMainQueueSetup() -> Bool { false }
}
```

`src/lib/widget.ts` already calls `setWidgetData(JSON.stringify(data))` then
`reloadAllTimelines()`. The `dataKey` (`"fieldnotes.widget.data"`) and App Group
must match the Swift `Provider.read()` above.

> If you'd rather avoid hand-writing the module, a published shared-defaults
> Expo module can be used — wire `widget.ts`'s `nativeBridge()` probe to its name.

---

## 5. Build & run — EAS dev build required (NOT Expo Go)

Widgets/ActivityKit are native; Expo Go cannot load them.

```bash
# 1. install the plugin(s)
npx expo install @bacons/apple-targets
# (optional) Live Activity JS API:
npm i react-native-widget-extension

# 2. generate native projects (creates ios/ with the widget target)
npx expo prebuild -p ios --clean

# 3a. local dev build on a simulator/device
npx expo run:ios

# 3b. or a cloud dev build (then install on device)
eas build --profile development --platform ios
```

- The **App Group** and the widget's **App ID** must exist in your Apple Developer
  account; EAS managed credentials can create them, or add them once in the
  Apple Developer portal and let EAS reuse them.
- Live Activities additionally need `NSSupportsLiveActivities` in the main app
  Info.plist (set via `ios.infoPlist`, §2b).
- After `prebuild`, open `ios/` in **Xcode 16** to iterate on the Swift views;
  re-running `prebuild --clean` regenerates from `targets/`.

---

## 6. Verifying

1. Run a dev build on a device (simulator works for the home widget; Dynamic
   Island needs iPhone 14 Pro+ sim or device).
2. In the app, complete a review (this fires `pushWidgetUpdate`, §INTEGRATION).
3. Add the **ByteShards** widget to the home screen → confirm streak/due/card.
4. Tap the widget → it deep-links to `mobile://daily` (the app's `scheme`).
5. For Live Activities: start a session, confirm the lock-screen banner / Dynamic
   Island ring updates as you answer, and ends when the session ends.

---

## 7. Gotchas

- **Field-name parity:** the Swift `WidgetData` struct must match `WidgetData` in
  `src/lib/widget.ts` exactly (names + optionality). Update both together.
- **One App Group id everywhere** (`group.com.byteshards.app`).
- **iOS 16.2 guard** all ActivityKit code with `@available(iOS 16.2, *)`.
- **No secrets in the App Group** unless you also set `keychainAccessGroup`.
- Android home widgets are out of scope here (would need Glance/`react-native-android-widget`);
  `widget.ts` already no-ops on Android, so nothing breaks.
