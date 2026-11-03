/* Native select + accessible search field for lists with 10+ choices. */
'use strict';
window.searchableSelect = function (select, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'select-search';
  const searchLabel = document.createElement('label');
  searchLabel.htmlFor = select.id + '-search';
  searchLabel.textContent = 'Search ' + label;
  const input = document.createElement('input');
  input.id = searchLabel.htmlFor;
  input.type = 'search';
  input.autocomplete = 'off';
  input.placeholder = 'Type to filter…';
  input.setAttribute('aria-controls', select.id);
  const hint = document.createElement('p');
  hint.className = 'small search-hint';
  hint.id = select.id + '-matches';
  hint.setAttribute('role', 'status');
  input.setAttribute('aria-describedby', hint.id);
  wrapper.append(searchLabel, input, hint);
  select.before(wrapper);
  let choices = [];
  let placeholder = 'Choose…';
  const fold = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  function filter() {
    const selected = select.value;
    const query = fold(input.value.trim());
    const matches = choices.filter(item => fold(item.label).includes(query));
    const first = document.createElement('option');
    first.value = '';
    first.textContent = matches.length ? placeholder : 'No matches';
    select.replaceChildren(first);
    for (const item of matches) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.append(option);
    }
    if (matches.some(item => item.value === selected)) select.value = selected;
    select.disabled = matches.length === 0;
    hint.textContent = matches.length + ' of ' + choices.length + ' choices';
  }
  input.addEventListener('input', filter);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; filter(); }
  });
  return {
    setValue(value) {
      if (!Array.from(select.options).some(option => option.value === value)) {
        input.value = '';
        filter();
      }
      select.value = value;
    },
    setOptions(items, prompt) {
      choices = items;
      placeholder = prompt;
      input.value = '';
      wrapper.hidden = choices.length < 10;
      filter();
    }
  };
};
