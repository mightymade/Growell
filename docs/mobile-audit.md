# Growell phone audit

Measured with Playwright (isMobile, hasTouch) at 375 by 667, 390 by 844, 412 by 915 and 360 by 780, light and dark mode. Each row combines all four sizes.

Checks: horizontal page overflow, tap targets under 44 by 44px, form inputs under 16px text, text under 12px, and whether the bottom tab bar stays on screen with the page scrolled to the top, middle and bottom.

## Landing

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | n/a (no tab bar on this screen) | n/a (no tab bar on this screen) |
| Horizontal overflow | none | none |
| Tap targets under 44px | 1 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: Get started.

## Log in

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | n/a (no tab bar on this screen) | n/a (no tab bar on this screen) |
| Horizontal overflow | none | none |
| Tap targets under 44px | 6 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: Enter your email, Enter your password, Forgot password?, Log inLogging in…, Show password, Sign up.

## Sign up

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | n/a (no tab bar on this screen) | n/a (no tab bar on this screen) |
| Horizontal overflow | none | none |
| Tap targets under 44px | 6 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: Continue, Create a password, Enter your email, Log in, Re-enter your password, Show password.

## Home

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | not on screen while scrolling | always on screen |
| Horizontal overflow | none | none |
| Tap targets under 44px | 2 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: Add field, Notifications, 1 new.

## Fields list (new)

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | screen did not exist | always on screen |
| Horizontal overflow | screen did not exist | none |
| Tap targets under 44px | screen did not exist | 0 |
| Inputs under 16px text | screen did not exist | 0 |
| Text under 12px | screen did not exist | 0 |

## Field page

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | not on screen while scrolling | always on screen |
| Horizontal overflow | none | none |
| Tap targets under 44px | 8 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: 1 open alert on this fie, Answer 1 in Alerts, Choose a field, Crop health layer, Delete Feild A, Edit, Notifications, 1 new, Sep 19, 2026.

## Add field

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | n/a (no tab bar on this screen) | n/a (no tab bar on this screen) |
| Horizontal overflow | none | none |
| Tap targets under 44px | 11 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: A, Back to dashboard, Choose planting date, Leaflet, Maize, My location, Search, Search for a town, distr, Zoom in, Zoom out, 🗺️ Streets.

## Alerts

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | not on screen while scrolling | always on screen |
| Horizontal overflow | none | none |
| Tap targets under 44px | 7 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: All fields, Change your answer, Feild A, Lab, No, something else, Notifications, Yes, that's what happene.

## Settings

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | not on screen while scrolling | always on screen |
| Horizontal overflow | none | none |
| Tap targets under 44px | 9 | 0 |
| Inputs under 16px text | 0 | 0 |
| Text under 12px | 0 | 0 |

Small targets before: Account, Appearance, INPUT, Notifications, 1 new, Password, Profile, Save changesSaving…, e.g. 07XX XXX XXX, e.g. Mukono.

## Settings: Profile (new)

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | screen did not exist | always on screen |
| Horizontal overflow | screen did not exist | none |
| Tap targets under 44px | screen did not exist | 0 |
| Inputs under 16px text | screen did not exist | 0 |
| Text under 12px | screen did not exist | 0 |

## Settings: Appearance (new)

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | screen did not exist | always on screen |
| Horizontal overflow | screen did not exist | none |
| Tap targets under 44px | screen did not exist | 0 |
| Inputs under 16px text | screen did not exist | 0 |
| Text under 12px | screen did not exist | 0 |

## Settings: Account (new)

| Check | Before | After |
|---|---|---|
| Tab bar while scrolling | screen did not exist | always on screen |
| Horizontal overflow | screen did not exist | none |
| Tap targets under 44px | screen did not exist | 0 |
| Inputs under 16px text | screen did not exist | 0 |
| Text under 12px | screen did not exist | 0 |

## Other problems found and fixed

- Bottom tab bar and top bar scrolled away with the page; both are now pinned and the page scrolls between them.
- Top bar repeated the bell (Alerts tab) and the avatar (Settings tab) and never named the screen; it now shows the screen title, a back arrow on inner screens, and one main action.
- Fields tab jumped into the last field; it now opens a list of fields. The field page has a field switcher on its title and a menu with Delete.
- Settings sections ran off the right edge; Settings is now a list, and each section is its own screen.
- Add field showed the form before the map; it is now map-first with large drawing buttons and a details panel once the shape is closed.
- Recent alerts could show "Invalid Date"; dates now fall back to "Date unknown".
- Alert answer buttons wrapped onto two lines; they are now two equal 48px buttons, and "Something else" opens a bottom sheet.
- The At a glance donut filled a whole phone screen; phones show a row of counts instead.
- The map layer button used an emoji; it now reads Streets or Satellite.
- All dialogs are bottom sheets on phones, close on a downward swipe or the phone's back button.
- A fixed Save bar inside an animated page was pinned to the page card instead of the screen (the page animation leaves a transform on the wrapper); it is now rendered on the page body.

## Not changed

- Form inputs were already 16px, so phones were not zooming in on tap. They are now also 48px tall.
- Tablet and computer layouts (768px and wider) are unchanged.
