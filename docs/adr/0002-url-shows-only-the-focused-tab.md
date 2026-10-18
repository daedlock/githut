# The URL shows only the focused tab

The browser URL is always the page in the focused tab, and links never encode the layout. Opening a link restores the viewer's own layout and focuses or opens that page. We rejected encoding the whole layout in the URL: links became long and fragile, and a shared link would impose the sender's layout on the reader. Browser back/forward replays onto the focused tab's own history instead of the window's.
