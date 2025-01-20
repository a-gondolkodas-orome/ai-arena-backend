import { DefaultCrudRepository, Entity } from "@loopback/repository";
import { Filter, FilterExcludingWhere } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { convertObjectIdsToString } from "../../shared/utils";

export class MongodbRepository<
  T extends Entity,
  ID extends string,
  Relations extends object,
> extends DefaultCrudRepository<T, ID, Relations> {
  override async find(filter?: Filter<T>, options?: Options) {
    console.log(
      `${this.modelClass.modelName}.find(${filter ? JSON.stringify(filter) : ""}${
        options ? ", " + JSON.stringify(options) : ""
      })`,
    );
    return (await super.find(filter, options)).map((entity) => convertObjectIdsToString(entity));
  }

  override async findOne(filter?: Filter<T>, options?: Options) {
    console.log(
      `${this.modelClass.modelName}.findOne(${JSON.stringify(filter)}${
        options ? ", " + JSON.stringify(options) : ""
      })`,
    );
    const entity = await super.findOne(filter, options);
    return entity ? convertObjectIdsToString(entity) : null;
  }

  override async findById(id: ID, filter?: FilterExcludingWhere<T>, options?: Options) {
    console.log(
      `${this.modelClass.modelName}.findById(${id}${filter ? ", " + JSON.stringify(filter) : ""}${
        options ? ", " + JSON.stringify(options) : ""
      })`,
    );
    return convertObjectIdsToString(await super.findById(id, filter, options));
  }
}
