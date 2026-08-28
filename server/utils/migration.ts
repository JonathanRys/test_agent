export const createTableFromModel = async (queryInterface: any, model: any) => {
  const tableName = model.tableName;
  const attributes = model.getAttributes();

  await queryInterface.createTable(tableName, attributes);
};
