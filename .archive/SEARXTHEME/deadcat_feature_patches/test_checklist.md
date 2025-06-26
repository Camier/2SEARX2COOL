# DEADCAT Theme Feature Testing Checklist

After applying patches, test each feature:

## 1. Autocomplete
- [ ] Start typing in search box
- [ ] Autocomplete suggestions appear
- [ ] Suggestions styled in terminal green
- [ ] Can select suggestion with keyboard/mouse

## 2. Categories
- [ ] Category checkboxes visible on results page
- [ ] Categories styled with terminal theme
- [ ] Can select/deselect categories
- [ ] Selected categories highlighted in green
- [ ] Search respects category selection

## 3. Time Range Filter
- [ ] Time range dropdown visible
- [ ] Dropdown styled in terminal theme
- [ ] Can select different time ranges
- [ ] Search results filtered by time
- [ ] Language selector also working

## 4. Calculator
- [ ] Search "2+2" shows calculated result
- [ ] Result displayed in special box
- [ ] Styled with terminal amber highlight
- [ ] Try other calculations: sqrt(16), 10*5

## 5. Overall Theme
- [ ] Terminal aesthetic maintained
- [ ] All text in monospace font
- [ ] Green/amber color scheme consistent
- [ ] No visual conflicts with new features

## Commands to restart after changes:
```bash
sudo systemctl restart searxng
sudo systemctl restart nginx
```
