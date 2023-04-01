import { DefaultCrudRepository, Entity } from "@loopback/repository";
import { Filter, FilterExcludingWhere } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { convertObjectIdsToString } from "../utils";

export class MongodbRepository<
  T extends Entity,
  ID,
  Relations extends object = {},
> extends DefaultCrudRepository<T, ID, Relations> {
  override async find(filter?: Filter<T>, options?: Options) {
    return (await super.find(filter, options)).map((entity) => convertObjectIdsToString(entity));
  }

  override async findOne(filter?: Filter<T>, options?: Options) {
    const entity = await super.findOne(filter, options);
    return entity ? convertObjectIdsToString(entity) : null;
  }

  override async findById(id: ID, filter?: FilterExcludingWhere<T>, options?: Options) {
    return convertObjectIdsToString(await super.findById(id, filter, options));
  }
}
