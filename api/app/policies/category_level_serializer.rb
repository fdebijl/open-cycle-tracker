class CategoryLevelPolicy < ApplicationPolicy
  def permitted_attributes
    super + [:icon, :name]
  end

  def permitted_attributes_for_filter
    super
  end
end
