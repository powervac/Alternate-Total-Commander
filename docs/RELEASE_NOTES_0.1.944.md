# Alternate Commander 0.1.944

Changes since 0.1.943.

## Servers are searched in the Find Files window
`Alt+F7` on a server panel (or **Net > Server File Database...**) now opens the same window as the search on local disks. The database of the server is built and updated at its top; an existing database is used as it is.

Available: name masks with exclusions and regular expressions, search folders and depth, dates, size, the Directory and Hidden attributes, duplicates by name or size, saved searches, sorting, F3 / F4, Go to file and Feed to listbox.

Not available for a server, because the database has names, sizes and dates only: text inside files, zip contents, duplicates by contents and the Read only attribute.

## Search by name (local disks and servers)
- A name with an extension finds only exactly this name: `103.jpg` no longer finds `DSC06103.JPG`. Use `*103.jpg` for every name that ends so.
- A word without wildcards still means "the name contains it".

This also applies to exclusions: `|desktop.ini` excludes only that name.

## Download and update
The program updates itself (Configuration > Check for Updates). All files are at https://altcom.cc
