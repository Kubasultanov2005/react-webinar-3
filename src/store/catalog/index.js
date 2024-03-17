import StoreModule from "../module";

/**
 * Состояние каталога - параметры фильтра и список товара
 */
class CatalogState extends StoreModule {

  /**
   * Начальное состояние
   * @return {Object}
   */
  initState() {
    return {
      list: [],
      params: {
        page: 1,
        limit: 10,
        sort: 'order',
        query: '',
        category: ''
      },
      categories: [{value: '', title: 'Все'}],
      count: 0,
      waiting: false
    }
  }


  /**
   * Получение категории.
   * @return {Promise<void>}
   */
  async getCategories() {
    const response = await fetch(`/api/v1/categories?fields=_id,title,parent(_id)&limit=*`);
    const json = await response.json();

    // Функция для рекурсивного добавления категорий с учетом их иерархии
    const flattenCategories = (categories) => {
      function getParentCategory(category) {
        return category.parent ? categories.find(c => c._id === category.parent._id) : null;
      }

      function getHierarchyLevel(category) {
        let level = 0;
        let parent = getParentCategory(category);
        while (parent) {
          level++;
          parent = getParentCategory(parent);
        }
        return level;
      }

      function buildModifiedCategories(category, modifiedCategories) {
        const hierarchyLevel = getHierarchyLevel(category);
        const prefix = ' -'.repeat(hierarchyLevel);
        const modifiedTitle = prefix + ' ' + category.title;
        modifiedCategories.push({ value: category._id, title: modifiedTitle });

        categories
          .filter(c => c.parent && c.parent._id === category._id)
          .forEach(child => buildModifiedCategories(child, modifiedCategories));
      }

      const modifiedCategories = [];
      categories.filter(category => !category.parent).forEach(rootCategory => {
        buildModifiedCategories(rootCategory, modifiedCategories);
      });

      return modifiedCategories;
    };

    const categories = flattenCategories(json.result.items);
    this.setState({
      ...this.getState(),
      categories: [...this.getState().categories, ...categories],
      waiting: false
    }, 'Загружены категории товаров из АПИ');
  }

  /**
   * Инициализация параметров.
   * Восстановление из адреса
   * @param [newParams] {Object} Новые параметры
   * @return {Promise<void>}
   */
  async initParams(newParams = {}) {
    await this.getCategories()
    const urlParams = new URLSearchParams(window.location.search);
    let validParams = {};
    if (urlParams.has('page')) validParams.page = Number(urlParams.get('page')) || 1;
    if (urlParams.has('limit')) validParams.limit = Math.min(Number(urlParams.get('limit')) || 10, 50);
    if (urlParams.has('sort')) validParams.sort = urlParams.get('sort');
    if (urlParams.has('query')) validParams.query = urlParams.get('query');
    await this.setParams({...this.initState().params, ...validParams, ...newParams}, true);
  }

  /**
   * Сброс параметров к начальным
   * @param [newParams] {Object} Новые параметры
   * @return {Promise<void>}
   */
  async resetParams(newParams = {}) {
    // Итоговые параметры из начальных, из URL и из переданных явно
    const params = {...this.initState().params, ...newParams};
    // Установка параметров и загрузка данных
    await this.setParams(params);
  }

  /**
   * Установка параметров и загрузка списка товаров
   * @param [newParams] {Object} Новые параметры
   * @param [replaceHistory] {Boolean} Заменить адрес (true) или новая запись в истории браузера (false)
   * @returns {Promise<void>}
   */
  async setParams(newParams = {}, replaceHistory = false) {
    const params = {...this.getState().params, ...newParams};

    // Установка новых параметров и признака загрузки
    this.setState({
      ...this.getState(),
      params,
      waiting: true
    }, 'Установлены параметры каталога');

    // Сохранить параметры в адрес страницы
    let urlSearch = new URLSearchParams(params).toString();
    const url = window.location.pathname + '?' + urlSearch + window.location.hash;
    if (replaceHistory) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }

    const apiParams = {
      limit: params.limit,
      skip: (params.page - 1) * params.limit,
      fields: 'items(*),count',
      sort: params.sort,
      'search[query]': params.query,
    };

    if (params.category && params.category !== '') {
      apiParams['search[category]'] = params.category;
    }

    const response = await fetch(`/api/v1/articles?${new URLSearchParams(apiParams)}`);
    const json = await response.json();
    this.setState({
      ...this.getState(),
      list: json.result.items,
      count: json.result.count,
      waiting: false
    }, 'Загружен список товаров из АПИ');
  }
}

export default CatalogState;
