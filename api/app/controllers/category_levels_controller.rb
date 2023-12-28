class CategoryLevelsController < ApplicationController
  before_action :find_category, only: [:create]
  before_action :find_category_level, only: [:show, :update, :destroy]
  before_action :find_category_levels, only: [:index, :filter]

  def index
    authorize @category_levels
    render json: @category_levels
  end

  def show
    authorize @category_level
    render json: @category_level
  end

  def filter
    @category_levels = @category_levels.where(id: permitted_attributes(resource_class)[:id]) if params[:filter].key?(:id)

    authorize @category_levels
    render json: @category_levels
  end

  def create
    @category_level = resource_class.new create_params

    if @category_level.save
      authorize @category_level
      render json: @category_level, status: :created, location: @category_level
    else
      skip_authorization
      render json: @category_level.errors, status: :unprocessable_entity
    end
  end

  def update
    throw NotImplementedError
  end

  def destroy
    throw NotImplementedError
  end

  protected

  def create_params
    permitted_attributes(resource_class).merge(
      user: current_user,
      category: @category
    )
  end

  def update_params
    permitted_attributes(@category_level)
  end

  def find_category
    @category = policy_scope(Category).find_by(id: params.dig(:data, :relationships, :category, :data, :id))
  end

  def find_category_level
    @category_level = policy_scope(resource_class).find(params[:id])
  end

  def find_category_levels
    @category_levels = policy_scope(resource_class)
  end
end
