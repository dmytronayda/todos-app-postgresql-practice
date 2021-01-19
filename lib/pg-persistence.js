const {
  dbQuery
} = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistance {
  constructor(session) {
    this.username = session.username;
  }
  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  // Does the todo list have any undone todos? Returns true if yes, false if no.
  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // Returns a new list of todo lists partitioned by completion status.
  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  // Returns a promise that resolves to a sorted list of all the todo lists
  // together with their todos. The list is sorted by completion status and
  // title (case-insensitive). The todos in the list are unsorted.
  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists WHERE username = $1 ORDER BY lower(title) ASC";
    const FIND_TODOS = "SELECT * FROM todos WHERE username = $1";

    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(FIND_TODOS, this.username);
    let resultBoth = await Promise.all([resultTodoLists, resultTodos]);

    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;
    if (!allTodoLists || !allTodos) return undefined;

    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id === todo.todolist_id;
      });
    });

    return this._partitionTodoLists(allTodoLists);
  }

  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1 AND username = $2";
    const ALL_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 AND username = $2";

    let resultTodoList = await dbQuery(FIND_TODOLIST, todoListId, this.username);
    let resultTodos = await dbQuery(ALL_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  // Returns a copy of the list of todos in the indicated todo list by sorted by
  // completion status and title (case-insensitive).
  async sortedTodos(todoList) {
    const SORTED_TODOS = "SELECT * FROM todos" +
      " WHERE todolist_id = $1 AND username = $2" +
      " ORDER BY done ASC, lower(title) ASC";

    let resultSorted = await dbQuery(SORTED_TODOS, todoList.id, this.username);

    return resultSorted.rows;
  }

  // Find a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = "SELECT * FROM todos" +
      " WHERE todolist_id = $1 AND id = $2";
    let result = await dbQuery(FIND_TODO, todoListId, todoId);
    return result.rows[0];
  };

  // Toggle a todo between the done and not done state. Returns `true` on
  // success, `false` if the todo or todo list doesn't exist. The id arguments
  // must both be numeric.
  async toggleDoneTodo(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
      " WHERE todolist_id = $1 AND id = $2 AND username = $3";

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }

  // Remove a todo from a todoList
  async deleteTodo(todoId) {
    const DELETE_TODO = "DELETE FROM todos WHERE id = $1 AND username = $2";
    let result = await dbQuery(DELETE_TODO, todoId, this.username);
    return result.rowCount > 0;
  }

  // Mark all todos as done
  async markAllDone(todoList) {
    const MARK_ALL_DONE = "UPDATE todos SET done = TRUE" +
      " WHERE todolist_id = $1 AND NOT done" +
      " AND username = $2";
    let result = await dbQuery(MARK_ALL_DONE, todoList.id, this.username);
    return result.rowCount > 0;
  }

  async deleteTodoList(todoListId) {
    const DELETE_LIST = "DELETE FROM todolists WHERE id = $1 AND username = $2";

    let result = await dbQuery(DELETE_LIST, todoListId, this.username);
    result.rowCount > 0;
  }

  async setTodoListTitle(todoListId, newTitle) {
    const UPDATE_TITLE = "UPDATE todolists SET title = $1 " +
      "WHERE id = $2 AND username = $3";

    let result = await dbQuery(UPDATE_TITLE, newTitle, todoListId, this.username);
    return result.rowCount > 0;
  }

  // Returns `true` if a todo list with the specified title exists in the list
  // of todo lists, `false` otherwise.
  async existsTodoListTitle(title) {
    const CHECK_TODOLIST_TITLE = "SELECT * FROM todolists " +
      "WHERE title = $1 AND username = $2";

    let result = await dbQuery(CHECK_TODOLIST_TITLE, title, this.username);
    return result.rowCount > 0;
  }

  // Add new todoList with a given title
  async createNewTodo(title, todoListId) {
    const ADD_TODO = "INSERT INTO todos (title, todolist_id)" +
      " VALUES($1, $2)" +
      "WHERE username = $3";

    let result = await dbQuery(ADD_TODO, title, todoListId, this.username);
    return result.rowCount > 0;
  }

  async checkCreds(username, password) {
    const FIND_WITH_CREDS = "SELECT password FROM users " +
      "WHERE username=$1";

    let result = await dbQuery(FIND_WITH_CREDS, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(_error) {
    return false;
  }

  async createNewTodolist(title) {
    const ADD_NEW_LIST = "INSERT INTO todolists (title, username) " +
      "VALUES ($1, $2)";

    try {
      let result = await dbQuery(ADD_NEW_LIST, title, this.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
};