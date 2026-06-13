class DayPolicy < ApplicationPolicy
  def permitted_attributes
    super + %i[order date cycle day-type]
  end

  def permitted_attributes_for_filter
    super + %i[today id]
  end
end
