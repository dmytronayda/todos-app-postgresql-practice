// Compare object titles alphabetically (case insensitive)
const compareByTitle = (itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } else if (titleA > titleB) {
    return 1;
  } else {
    return 0;
  }
};

// Sort and return a list of todo lists or todos that have been partitioned by
// their completion status.
const sortItems = (undone, done) => {
  undone.sort(compareByTitle);
  done.sort(compareByTitle);
  return [].concat(undone, done);
};

module.exports = {
  // Return a list of todo lists or todos sorted by their completion status and
  // title (case-sensitive). The uncompleted and completed items must be passed
  // to the method via the `undone` and `done` arguments.
  sortTodoLists: sortItems,
  sortTodos: sortItems,
};
